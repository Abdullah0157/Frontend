// ─────────────────────────────────────────────────────────────────────────
// Interview Planner — DEIE Strategy Planner + belief loop (see INTERVIEWER_ENGINE.md)
// Makes the interviewer and the evaluator ONE system: the rubric's competency
// posteriors ARE the interview's belief state, and the planner asks about the
// competency that is most important AND least certain (max information gain).
//
// Pure/deterministic on purpose — the ONE AI call (scoring the transcript) lives
// in the API layer; everything here is unit-tested logic operating on the
// resulting EIE profile.
// ─────────────────────────────────────────────────────────────────────────

import { buildModel } from './competency-framework.js'

// Required confidence per competency to consider it "settled". Critical, high-
// weight competencies at senior levels demand more evidence.
const SENIORITY_BASE = { ic3: 0.5, senior: 0.55, staff: 0.62, exec: 0.65 }
export function requiredConfidence(seniority, weight) {
  const base = SENIORITY_BASE[seniority] ?? 0.55
  return Math.min(0.85, base + 0.3 * (weight || 0))
}

// ── Strategy Planner: build the objective set before question 1 ─────────────
export function buildStrategy(role, seniority, resumeHooks = {}) {
  const model = buildModel(role, seniority || role)
  const objectives = model.competencies.map((c) => ({
    competency_id: c.id,
    name: c.name,
    importance: c.weight,
    required_confidence: requiredConfidence(model.seniority, c.weight),
    interview_signals: c.positive_indicators || [],
    evidence_requirements: c.evidence_requirements || { min_episodes: 1 },
    resume_hooks: resumeHooks[c.id] || [],
    status: 'unknown',
  }))
  return { framework_version: model.framework_version, role_family: model.role_family, seniority: model.seniority, model, objectives }
}

// Status ladder: unknown → partial → strong → verified.
export function statusFor(comp, requiredConf) {
  if (!comp || comp.state !== 'measured') return 'unknown'
  const ev = Array.isArray(comp.evidence) ? comp.evidence.length : 0
  if (comp.refuted) return 'partial'                       // challenged and failed → not settled
  if (comp.confidence >= requiredConf && ev >= 2) return 'verified'
  if (comp.confidence >= requiredConf) return 'strong'
  return 'partial'
}

function statusBoost(status) {
  return { unknown: 1.3, partial: 1.0, strong: 0.3, verified: 0 }[status] ?? 1
}

// Which conversational move to make — refined with anti-repetition (step 4):
// after grinding a topic without settling it, switch instead of re-asking.
export function moveFor(comp, status, turnsSpent = 0) {
  if (comp?.refuted || (comp?.risk && comp.risk.length)) return 'resolve'
  if (status === 'unknown') return turnsSpent >= 2 ? 'switch' : 'open'
  if (status === 'partial') return turnsSpent >= 2 ? 'switch' : 'deepen'
  if (status === 'strong') return 'verify'
  return 'switch'
}

// ── Interview Critic (step 5) ──────────────────────────────────────────────
// After an answer, judge whether the last question actually did its job on the
// target competency. Drives "probe deeper vs switch" and flags evasion (probed
// but no signal gained) — the absence of evidence under direct probing IS signal.
export function critique(prevBelief, nextBelief, targetId, { usefulDelta = 0.05 } = {}) {
  if (!targetId) return null
  const prev = (prevBelief || []).find((b) => b.competency_id === targetId) || {}
  const next = (nextBelief || []).find((b) => b.competency_id === targetId) || {}
  const dConf = round2((next.confidence ?? 0) - (prev.confidence ?? 0))
  const gainedEvidence = (next.evidence_count ?? 0) > (prev.evidence_count ?? 0)
  const settled = next.status === 'strong' || next.status === 'verified'
  const useful = gainedEvidence || dConf >= usefulDelta || settled
  // Evasive: we directly probed this competency and learned essentially nothing.
  const evasive = !useful && (prev.turns_spent ?? 0) >= 1
  return {
    target: targetId,
    delta_confidence: dConf,
    gained_evidence: gainedEvidence,
    settled,
    useful,
    evasive,
    verdict: settled ? 'settled' : useful ? 'productive' : evasive ? 'evasive' : 'weak',
    recommendation: settled || evasive ? 'switch' : useful ? 'deepen' : 'reframe',
  }
}
const round2 = (n) => Math.round(n * 100) / 100

// ── Resume-hook extraction (step 4) ────────────────────────────────────────
// Heuristically pull impressive/quantified claims from the resume and map them
// to competencies, so the planner can prioritize VERIFYING them (never accept an
// impressive claim un-probed). Cheap + deterministic — no LLM call.
export function extractResumeHooks(resumeText, model) {
  const hooks = {}
  if (!resumeText || !model?.competencies) return hooks
  const lines = String(resumeText).split(/[\n.;]+/).map((s) => s.trim()).filter((s) => s.length > 12)
  const push = (id, claim) => { (hooks[id] ||= []).push(claim.slice(0, 120)) }
  const has = (id) => model.competencies.some((c) => c.id === id)
  for (const line of lines) {
    const quantified = /\d+\s*%|\bx\b|\$\d|\bp99\b|\d{2,}|\bmillion\b|\bthousand\b/i.test(line)
    const leadership = /\b(led|managed|owned|drove|founded|built a team|mentored|hired)\b/i.test(line)
    const technical = /\b(architected|designed|scaled|optimized|migrated|deployed|debugged|latency|throughput|infrastructure|api|model)\b/i.test(line)
    // Quantified outcomes and leadership are evidence of Ownership (owned,
    // measurable work); technical claims map to Technical Depth / System Design.
    if ((quantified || leadership) && has('ownership')) push('ownership', line)
    if (technical && has('technical_depth')) push('technical_depth', line)
    if (technical && has('system_design') && /\b(architect|scale|design|distributed)\b/i.test(line)) push('system_design', line)
  }
  // cap to 3 hooks per competency
  for (const k of Object.keys(hooks)) hooks[k] = hooks[k].slice(0, 3)
  return hooks
}

// Expected information gain: most important × least certain. Verified/settled
// competencies are skipped (−Infinity). See INTERVIEWER_ENGINE.md §5.
export function expectedInfoGain(compBelief) {
  if (compBelief.status === 'verified' || compBelief.settled) return -Infinity
  const se = Number.isFinite(compBelief.se) ? compBelief.se : 1.0   // unknown → max uncertainty
  const base = (compBelief.importance ** 2) * (se * se) * statusBoost(compBelief.status)
  const verifyBonus = compBelief.resume_hooks?.length ? 0.02 : 0
  const contradictionBonus = compBelief.status === 'partial' && compBelief.refuted ? 0.05 : 0
  const fatigue = compBelief.turns_spent ? Math.pow(0.6, compBelief.turns_spent) : 1
  return (base + verifyBonus + contradictionBonus) * fatigue
}

// ── The belief loop: map a fresh EIE profile → planning state ────────────────
export function planFromProfile(strategy, profile, { turnsSpent = {}, answered = 0, minAnswers = 4, prevBelief = null, lastTarget = null } = {}) {
  const byId = {}
  for (const c of profile?.competencies || []) byId[c.id] = c

  const belief = strategy.objectives.map((o) => {
    const comp = byId[o.competency_id] || {}
    const status = statusFor(comp, o.required_confidence)
    const b = {
      competency_id: o.competency_id,
      name: o.name,
      importance: o.importance,
      required_confidence: o.required_confidence,
      resume_hooks: o.resume_hooks,
      status,
      settled: status === 'verified' || status === 'strong',
      theta: comp.theta ?? null,
      se: comp.se ?? null,
      confidence: comp.confidence ?? 0,
      evidence_count: Array.isArray(comp.evidence) ? comp.evidence.length : 0,
      refuted: !!comp.refuted,
      risk: comp.risk || [],
      turns_spent: turnsSpent[o.competency_id] || 0,
      interview_signals: o.interview_signals,
    }
    b.info_gain = expectedInfoGain(b)
    b.move = moveFor(comp, status, b.turns_spent)
    return b
  })

  // Interview Critic (step 5): grade the last question, and if the candidate
  // dodged, steer AWAY from that competency this turn (don't badger).
  const crit = critique(prevBelief, belief, lastTarget)
  if (crit?.evasive) {
    const evaded = belief.find((b) => b.competency_id === lastTarget)
    if (evaded) { evaded.info_gain *= 0.15; evaded.move = 'switch'; evaded.evasive = true }
  }

  const open = belief.filter((b) => b.info_gain > -Infinity)
  const next = open.length ? open.reduce((a, b) => (b.info_gain > a.info_gain ? b : a)) : null
  const coverage = profile?.coverage ?? 0

  // Ready to conclude = enough answered AND (decision stable OR critical settled).
  const stability = decisionStability(profile)
  const ready = answered >= minAnswers && (stability.stable || readyToConclude(belief, coverage))

  return {
    belief,
    coverage,
    decision: profile?.decision ?? null,
    decision_stability: stability,
    open_objectives: open.map((b) => b.name),
    next_target: ready ? null : (next
      ? { competency_id: next.competency_id, name: next.name, move: next.move, interview_signals: next.interview_signals, resume_hooks: next.resume_hooks }
      : null),
    ready_to_conclude: ready,
    conclude_reason: ready ? (stability.stable ? stability.reason : 'critical competencies settled') : null,
    critique: crit,
  }
}

// Stop when the critical competencies are settled and coverage is high.
export function readyToConclude(belief, coverage, { criticalWeight = 0.12, minCoverage = 0.85 } = {}) {
  const critical = belief.filter((b) => b.importance >= criticalWeight)
  const pool = critical.length ? critical : belief
  const allSettled = pool.every((b) => b.status === 'strong' || b.status === 'verified')
  const noOpenContradiction = !belief.some((b) => b.refuted && b.status !== 'verified')
  return coverage >= minCoverage && allSettled && noOpenContradiction
}

// PRIMARY stop condition (INTERVIEWER_ENGINE.md §9): the decision is stable when
// the composite credible interval no longer STRADDLES the hire bar — i.e., even
// at the pessimistic/optimistic edges of what we're unsure about, the hire/no-
// hire call wouldn't change. Continue only while more evidence could still flip it.
export function decisionStability(profile, { minCoverage = 0.6 } = {}) {
  const d = profile?.decision || {}
  const ci = profile?.composite_ci90
  const bar = d.bar
  const coverage = profile?.coverage ?? 0
  if (!Array.isArray(ci) || !Number.isFinite(bar)) {
    return { stable: false, reason: 'no composite credible interval yet' }
  }
  const [lo, hi] = ci
  const straddles = lo < bar && hi > bar
  const margin = Math.round(Math.min(Math.abs(lo - bar), Math.abs(hi - bar)) * 100) / 100
  const stable = !straddles && coverage >= minCoverage
  return {
    stable,
    straddles,
    side: hi <= bar ? 'below_bar' : lo >= bar ? 'above_bar' : 'straddles',
    bar, ci, margin, coverage,
    reason: straddles
      ? 'credible interval straddles the hire bar — more evidence could still flip the decision'
      : coverage < minCoverage
        ? `coverage ${Math.round(coverage * 100)}% too low to conclude`
        : 'decision robust to remaining uncertainty',
  }
}

// Build a directive the question generator injects so Maya targets this
// competency (turned into a natural single question by the Presenter/persona).
export function targetDirective(next) {
  if (!next) return ''
  const moveText = {
    open: 'You have NO solid evidence for this competency yet — ask an open behavioral question to elicit a concrete real example.',
    deepen: 'You have partial evidence — go one level deeper on the SAME thread: ask what was hardest, what broke, or what the trade-off was.',
    verify: 'This looks strong — respectfully CHALLENGE it: ask what a skeptic would say, or for the specific detail only a real expert would know.',
    resolve: 'There is a contradiction or a failed claim here — ask them to reconcile it directly.',
    switch: 'Move to this new area.',
  }[next.move] || ''
  const hooks = next.resume_hooks?.length ? ` Anchor it to their resume: ${next.resume_hooks.slice(0, 2).join('; ')}.` : ''
  const signals = next.interview_signals?.length ? ` Good evidence looks like: ${next.interview_signals.slice(0, 3).join('; ')}.` : ''
  return `\n\nINVESTIGATION TARGET → ${next.name}. ${moveText}${signals}${hooks} Ask exactly ONE natural question aimed at this.`
}
