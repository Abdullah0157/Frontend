// ─────────────────────────────────────────────────────────────────────────
// EIE Scoring — Phase 1 (deterministic aggregation over anchored ratings).
// This is intentionally the "degenerate case" of EVALUATION_ENGINE.md §6:
// one rater, linear level→score, no GRM yet. It already delivers the honest
// upgrades: Unknown/abstain, coverage, evidence-linked scores, mechanical
// composite, and utility-free banding. Bayesian θ + G-theory arrive in Phase 2/3.
// ─────────────────────────────────────────────────────────────────────────

import { grmPosterior, grmPosteriorMulti, compositePosterior, priorMeanForSeniority, normalCdf, raterAgreement, profileDependability } from './psychometrics.js'
import { decideHire } from './decision-engine.js'

const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n))

// Merge the model (competency defs + weights) with the model-produced ratings
// into a finalized, defensible competency profile + decision.
export function finalizeProfile(model, ratings) {
  const byId = {}
  for (const r of ratings || []) if (r && r.competency_id) byId[r.competency_id] = r

  const priorMean = priorMeanForSeniority(model.seniority)

  const competencies = model.competencies.map((c) => {
    const r = byId[c.id] || {}
    const level = Number(r.bars_level)
    let confidence = clamp(Number(r.confidence) || 0, 0, 1)
    const minEp = c.evidence_requirements?.min_episodes ?? 1
    const episodes = Array.isArray(r.evidence) ? r.evidence.length : (r.evidence ? 1 : 0)

    // Abstain → "unknown" (NOT a low score) only when there is genuinely too
    // little information: no level, the rater abstained, or confidence is very
    // low. Falling short of the ideal episode count does NOT discard the signal —
    // it just widens uncertainty (confidence is capped). See §4.5.
    const insufficient = !Number.isFinite(level) || r.state === 'unknown' || confidence < 0.35
    if (!insufficient && episodes < minEp) confidence = Math.min(confidence, 0.55)
    const state = insufficient ? 'unknown' : 'measured'
    const thin = state === 'measured' && episodes < minEp
    const failure = Array.isArray(r.failure_triggered) ? r.failure_triggered : (r.failure_triggered ? [r.failure_triggered] : [])

    // ── Measurement: Bayesian posterior over latent ability θ (Phase 2) ──
    let post = null
    if (state === 'measured') {
      // Effective information = rater confidence × number of cited episodes
      // (each episode is a locally-independent observation of θ). More, better-
      // evidenced behavior ⇒ tighter credible interval & higher reliability.
      const effObs = confidence * clamp(episodes, 1, 3)
      post = grmPosterior({
        level: clamp(level, 1, 5),
        weight: effObs,
        a: c.discrimination,           // optional per-competency override
        priorMean,
      })
    }

    return {
      id: c.id, name: c.name, cluster: c.cluster, weight: c.weight,
      state, bars_level: state === 'measured' ? clamp(level, 1, 5) : null,
      // score (0–100) is the norm-population percentile of θ — intuitive UI metric.
      score: post ? post.percentile : null,
      theta: post ? post.theta : null,
      se: post ? post.se : null,
      ci90: post ? post.ci90 : null,
      ci_pct: post ? [Math.round(normalCdf(post.ci90[0]) * 100), Math.round(normalCdf(post.ci90[1]) * 100)] : null,
      reliability: post ? post.reliability : null,
      confidence,
      evidence: Array.isArray(r.evidence) ? r.evidence.slice(0, 3) : [],
      followup: state === 'unknown' ? (r.followup || defaultFollowup(c)) : null,
      thin,
      risk: failure,
    }
  })

  // Mechanical composite over MEASURED competencies only; unknowns excluded,
  // never imputed as average. Uncertainty propagated correctly (§4). coverage =
  // fraction of decision weight measured.
  const measured = competencies.filter((c) => c.state === 'measured')
  const comp = compositePosterior(measured.map((c) => ({ theta: c.theta, se: c.se, weight: c.weight })))
  const covered = measured.reduce((s, c) => s + c.weight, 0)
  const totalW = competencies.reduce((s, c) => s + c.weight, 0)
  const wMeasured = covered || 0

  const composite = comp ? comp.percentile : null      // 0–100 (percentile of composite θ)
  const coverage = totalW > 0 ? Math.round((covered / totalW) * 100) / 100 : 0
  const overallConfidence = wMeasured > 0
    ? Math.round((measured.reduce((s, c) => s + c.confidence * c.weight, 0) / wMeasured) * 100) / 100
    : 0
  const overallReliability = wMeasured > 0
    ? Math.round((measured.reduce((s, c) => s + (c.reliability || 0) * c.weight, 0) / wMeasured) * 100) / 100
    : 0

  const criticalFailures = competencies.filter((c) => c.risk && c.risk.length > 0).map((c) => c.name)
  const decision = decideHire({ theta: comp ? comp.theta : null, se: comp ? comp.se : null, coverage, criticalFailures, seniority: model.seniority })
  if (decision.band === 'Hire with Reservations' || decision.band === 'Borderline') {
    decision.reservations = competencies.filter((c) => c.state === 'measured' && c.weight >= 0.08 && c.score < 50).map((c) => c.name)
  }

  return {
    framework_version: model.framework_version,
    role_family: model.role_family,
    seniority: model.seniority,
    measurement_model: 'grm-eap-v1',
    competencies,
    composite_score: composite,        // 0–100 percentile of composite θ
    composite_theta: comp ? comp.theta : null,
    composite_ci90: comp ? comp.ci90 : null,
    coverage,                          // 0–1
    overall_confidence: overallConfidence,
    overall_reliability: overallReliability,
    decision,
    unknown_competencies: competencies.filter((c) => c.state === 'unknown').map((c) => c.name),
    followups: competencies.filter((c) => c.followup).map((c) => ({ competency: c.name, question: c.followup })),
  }
}


// ── Phase 3: ensemble aggregation ─────────────────────────────────────────
// byComp[competency_id] = array of per-rater ratings ({state, bars_level,
// confidence, evidence, failure_triggered, followup}). refutations[id] =
// { refuted, reason } from the adversarial pass.
export function finalizeProfileEnsemble(model, byComp, refutations = {}, meta = {}) {
  const priorMean = priorMeanForSeniority(model.seniority)
  const nRaters = meta.rater_count || 1

  const competencies = model.competencies.map((c) => {
    const raters = Array.isArray(byComp[c.id]) ? byComp[c.id] : []
    const measuredRaters = raters.filter((r) => r && r.state !== 'unknown' && Number.isFinite(Number(r.bars_level)) && (Number(r.confidence) || 0) >= 0.35)
    const minEp = c.evidence_requirements?.min_episodes ?? 1
    const refuted = !!refutations[c.id]?.refuted

    // Unknown if a MAJORITY of raters abstained / had too little.
    if (measuredRaters.length === 0 || measuredRaters.length < Math.ceil(raters.length / 2)) {
      const fu = raters.find((r) => r?.followup)?.followup || defaultFollowup(c)
      return { id: c.id, name: c.name, cluster: c.cluster, weight: c.weight, state: 'unknown', followup: fu, rater_count: raters.length }
    }

    const levels = measuredRaters.map((r) => clamp(Number(r.bars_level), 1, 5))
    const agreement = raterAgreement(levels)
    const episodesEach = measuredRaters.map((r) => (Array.isArray(r.evidence) ? r.evidence.length : (r.evidence ? 1 : 0)))
    const totalEpisodes = Math.max(...episodesEach, 1)
    const thin = totalEpisodes < minEp
    const refuteFactor = refuted ? 0.4 : 1

    // Each rater contributes one observation; weight = its confidence × its
    // cited episodes × refutation factor. Agreement/disagreement flows through
    // the multi-observation posterior automatically.
    const observations = measuredRaters.map((r, i) => {
      let conf = clamp(Number(r.confidence) || 0, 0, 1)
      if (thin) conf = Math.min(conf, 0.55)
      return { level: clamp(Number(r.bars_level), 1, 5), weight: conf * clamp(episodesEach[i], 1, 3) * refuteFactor }
    })

    const post = grmPosteriorMulti({ observations, a: c.discrimination, priorMean })
    const meanLevel = Math.round(levels.reduce((s, x) => s + x, 0) / levels.length)
    const meanConf = clamp(measuredRaters.reduce((s, r) => s + (Number(r.confidence) || 0), 0) / measuredRaters.length, 0, 1) * refuteFactor
    // best evidence = from the rater who cited the most
    const richest = measuredRaters.slice().sort((a, b) => (b.evidence?.length || 0) - (a.evidence?.length || 0))[0]
    const failures = measuredRaters.flatMap((r) => Array.isArray(r.failure_triggered) ? r.failure_triggered : (r.failure_triggered ? [r.failure_triggered] : []))

    return {
      id: c.id, name: c.name, cluster: c.cluster, weight: c.weight,
      state: 'measured', bars_level: meanLevel,
      score: post.percentile, theta: post.theta, se: post.se, ci90: post.ci90,
      ci_pct: [Math.round(normalCdf(post.ci90[0]) * 100), Math.round(normalCdf(post.ci90[1]) * 100)],
      reliability: post.reliability,
      confidence: Math.round(meanConf * 100) / 100,
      rater_count: measuredRaters.length,
      rater_agreement: agreement,
      refuted, refute_reason: refuted ? refutations[c.id]?.reason : null,
      evidence: Array.isArray(richest?.evidence) ? richest.evidence.slice(0, 3) : [],
      thin,
      risk: failures,
      _levels: levels,
    }
  })

  return assembleProfile(model, competencies, { ...meta, rater_count: nRaters })
}

// Shared assembly used by single-rater and ensemble paths.
function assembleProfile(model, competencies, meta = {}) {
  const measured = competencies.filter((c) => c.state === 'measured')
  const comp = compositePosterior(measured.map((c) => ({ theta: c.theta, se: c.se, weight: c.weight })))
  const covered = measured.reduce((s, c) => s + c.weight, 0)
  const totalW = competencies.reduce((s, c) => s + c.weight, 0)
  const wMeasured = covered || 0

  const composite = comp ? comp.percentile : null
  const coverage = totalW > 0 ? Math.round((covered / totalW) * 100) / 100 : 0
  const overallConfidence = wMeasured > 0
    ? Math.round((measured.reduce((s, c) => s + c.confidence * c.weight, 0) / wMeasured) * 100) / 100 : 0
  const overallReliability = wMeasured > 0
    ? Math.round((measured.reduce((s, c) => s + (c.reliability || 0) * c.weight, 0) / wMeasured) * 100) / 100 : 0

  // G-theory dependability of the profile against rater swaps (needs ≥2 raters
  // measuring ≥2 shared competencies). Build a RECTANGULAR competency×rater
  // matrix from competencies rated by the same number of raters.
  let dependability = null
  if ((meta.rater_count || 1) >= 2) {
    const withLevels = measured.filter((c) => Array.isArray(c._levels) && c._levels.length >= 2)
    const lenCounts = {}
    withLevels.forEach((c) => { lenCounts[c._levels.length] = (lenCounts[c._levels.length] || 0) + 1 })
    const L = Object.keys(lenCounts).map(Number).sort((a, b) => lenCounts[b] - lenCounts[a])[0]
    const matrix = withLevels.filter((c) => c._levels.length === L).map((c) => c._levels)
    dependability = profileDependability(matrix)
  }
  // strip internal field from output
  competencies.forEach((c) => { delete c._levels })

  const criticalFailures = competencies.filter((c) => c.risk && c.risk.length > 0).map((c) => c.name)
  const decision = decideHire({ theta: comp ? comp.theta : null, se: comp ? comp.se : null, coverage, criticalFailures, seniority: model.seniority })
  if (decision.band === 'Hire with Reservations' || decision.band === 'Borderline') {
    decision.reservations = competencies.filter((c) => c.state === 'measured' && c.weight >= 0.08 && c.score < 50).map((c) => c.name)
  }

  return {
    framework_version: model.framework_version,
    role_family: model.role_family,
    seniority: model.seniority,
    measurement_model: 'grm-eap-v1',
    rater_count: meta.rater_count || 1,
    rater_dependability: dependability?.dependability ?? null,
    variance_components: dependability ? { comp: dependability.vComp, rater: dependability.vRater, resid: dependability.vResid } : null,
    competencies,
    composite_score: composite,
    composite_theta: comp ? comp.theta : null,
    composite_ci90: comp ? comp.ci90 : null,
    coverage,
    overall_confidence: overallConfidence,
    overall_reliability: overallReliability,
    decision,
    unknown_competencies: competencies.filter((c) => c.state === 'unknown').map((c) => c.name),
    followups: competencies.filter((c) => c.followup).map((c) => ({ competency: c.name, question: c.followup })),
  }
}

function defaultFollowup(c) {
  return `Ask for a specific real example that would demonstrate ${c.name.toLowerCase()}.`
}

export const DECISION_BANDS = [
  'Strong Hire', 'Hire', 'Hire with Reservations', 'Borderline',
  'Needs More Evidence', 'No Hire', 'Strong No Hire',
]
