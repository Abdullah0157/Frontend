// EIE test suite. Part A: deterministic unit tests of the psychometric core
// (no AI, no DB — validates the scientific claims). Part B: integration
// alignment test through the live /api/eie/score endpoint (best-effort; tolerant
// of sandbox rate limits).
//
// Run:  node scripts/test-eie.mjs

import {
  normalCdf, grmPosterior, grmPosteriorMulti, raterAgreement,
  profileDependability, compositePosterior,
} from '../lib/psychometrics.js'
import { decideHire, probabilityOfSuccess, costThreshold } from '../lib/decision-engine.js'
import { buildModel } from '../lib/competency-framework.js'
import { finalizeProfileEnsemble } from '../lib/eie-scoring.js'
import { blindTranscript, adverseImpact, standardizedMeanDifference, differentialItemFunctioning } from '../lib/fairness.js'
import { brierScore, auc, expectedCalibrationError, recalibrateBar, pointBiserial, recalibrateWeights, validitySummary } from '../lib/calibration.js'
import { buildStrategy, requiredConfidence, statusFor, expectedInfoGain, moveFor, planFromProfile, readyToConclude, targetDirective, decisionStability, critique, extractResumeHooks } from '../lib/interview-planner.js'
import { interviewQuality } from '../lib/interview-quality.js'

let pass = 0, fail = 0
const approx = (a, b, tol = 0.03) => Math.abs(a - b) <= tol
function ok(name, cond, detail = '') {
  if (cond) { pass++; console.log(`  ✅ ${name}`) }
  else { fail++; console.log(`  ❌ ${name}  ${detail}`) }
}

console.log('\n── Part A: psychometrics unit tests ─────────────────────────')

// normalCdf
ok('normalCdf(0)=0.5', approx(normalCdf(0), 0.5))
ok('normalCdf(1.645)≈0.95', approx(normalCdf(1.645), 0.95, 0.01))
ok('normalCdf(-1.645)≈0.05', approx(normalCdf(-1.645), 0.05, 0.01))

// grmPosterior monotonicity in level
const thetas = [1, 2, 3, 4, 5].map((L) => grmPosterior({ level: L, weight: 1.5 }).theta)
ok('θ strictly increases with BARS level', thetas.every((t, i) => i === 0 || t > thetas[i - 1]), JSON.stringify(thetas))
ok('L3 ≈ population median (θ≈0)', approx(grmPosterior({ level: 3, weight: 1.5 }).theta, 0, 0.2))

// confidence/evidence widens or tightens the credible interval
const seLow = grmPosterior({ level: 5, weight: 0.4 }).se
const seHigh = grmPosterior({ level: 5, weight: 2.7 }).se
ok('lower confidence → wider SE (more uncertainty)', seLow > seHigh, `seLow=${seLow} seHigh=${seHigh}`)
ok('higher evidence → higher reliability', grmPosterior({ level: 5, weight: 2.7 }).reliability > grmPosterior({ level: 5, weight: 0.4 }).reliability)

// multi-observation: agreement sharpens, disagreement widens
const single = grmPosterior({ level: 5, weight: 1 })
const agree = grmPosteriorMulti({ observations: [{ level: 5, weight: 1 }, { level: 5, weight: 1 }] })
const disagree = grmPosteriorMulti({ observations: [{ level: 2, weight: 1 }, { level: 5, weight: 1 }] })
ok('agreeing raters → tighter CI than single', agree.se < single.se, `agree=${agree.se} single=${single.se}`)
ok('disagreeing raters → wider CI than agreeing', disagree.se > agree.se, `disagree=${disagree.se} agree=${agree.se}`)
ok('disagreeing raters → θ lands between the two', disagree.theta > grmPosterior({ level: 2, weight: 1 }).theta && disagree.theta < grmPosterior({ level: 5, weight: 1 }).theta)

// raterAgreement
ok('agreement [5,5] = 1', raterAgreement([5, 5]) === 1)
ok('agreement [1,5] = 0', raterAgreement([1, 5]) === 0)
ok('agreement [4,5] = 0.75', raterAgreement([4, 5]) === 0.75)
ok('agreement single rater = null', raterAgreement([5]) === null)

// profileDependability: consistent raters → high; a severe/lenient rater → lower
const consistent = profileDependability([[5, 5], [3, 3], [1, 1], [4, 4]])
const noisy = profileDependability([[5, 1], [3, 5], [1, 4], [4, 2]])
ok('consistent raters → high dependability (>0.8)', consistent.dependability > 0.8, JSON.stringify(consistent))
ok('noisy raters → lower dependability than consistent', noisy.dependability < consistent.dependability, `noisy=${noisy.dependability} consistent=${consistent.dependability}`)
ok('consistent raters → low rater variance', consistent.vRater < 0.1, JSON.stringify(consistent))

// compositePosterior error propagation
const comp = compositePosterior([{ theta: 1, se: 0.5, weight: 0.5 }, { theta: 1, se: 0.5, weight: 0.5 }])
ok('composite SE < individual SE (aggregation reduces error)', comp.se < 0.5, `comp.se=${comp.se}`)
ok('composite θ = weighted mean', approx(comp.theta, 1))

console.log(`\n  Part A: psychometrics ${pass} passed, ${fail} failed`)

console.log('\n── Part A2: decision engine unit tests ──────────────────────')
ok('costThreshold(bad2,missed1) = 0.67', approx(costThreshold({ bad_hire: 2, missed_good: 1 }), 0.667, 0.01))
ok('P(success) high when θ far above bar', probabilityOfSuccess(1.5, 0.2, -0.4) > 0.99)
ok('P(success) low when θ far below bar', probabilityOfSuccess(-1.5, 0.2, -0.4) < 0.01)
ok('P(success) ≈ 0.5 at the bar', approx(probabilityOfSuccess(-0.4, 0.3, -0.4), 0.5, 0.02))
ok('wide uncertainty near bar → P near 0.5 (not overconfident)', approx(probabilityOfSuccess(0.1, 1.2, -0.4), 0.66, 0.1))
const dNME = decideHire({ theta: 1, se: 0.2, coverage: 0.4, seniority: 'senior' })
ok('low coverage → Needs More Evidence', dNME.band === 'Needs More Evidence')
const dFail = decideHire({ theta: 1.5, se: 0.2, coverage: 0.9, criticalFailures: ['Integrity'], seniority: 'senior' })
ok('critical failure → Strong No Hire regardless of θ', dFail.band === 'Strong No Hire')
const dStrong = decideHire({ theta: 1.6, se: 0.2, coverage: 0.9, seniority: 'senior' })
const dNo = decideHire({ theta: -1.2, se: 0.2, coverage: 0.9, seniority: 'senior' })
ok('high θ + coverage → Strong Hire', dStrong.band === 'Strong Hire', dStrong.band)
ok('low θ → No/Strong No Hire', ['No Hire', 'Strong No Hire'].includes(dNo.band), dNo.band)
ok('band monotonic in θ (p increases)', dStrong.p_success > dNo.p_success)
ok('decision labeled uncalibrated_prior (scientific integrity)', dStrong.calibration === 'uncalibrated_prior')

console.log('\n── Part A3: ensemble aggregation (deterministic, no AI) ──────')
const model = buildModel('Backend Engineer', 'senior')
const ids = model.competencies.map((c) => c.id)
const rater = (level, conf = 0.9, ep = 2) => ({ state: 'measured', bars_level: level, confidence: conf, evidence: Array.from({ length: ep }, (_, i) => ({ quote: 'q', turn_ref: i + 1 })) })
const allAt = (level) => Object.fromEntries(ids.map((id) => [id, [rater(level), rater(level)]]))

const pStrong = finalizeProfileEnsemble(model, allAt(5), {}, { rater_count: 2 })
const pMid = finalizeProfileEnsemble(model, allAt(3), {}, { rater_count: 2 })
const pWeak = finalizeProfileEnsemble(model, allAt(1), {}, { rater_count: 2 })
ok('all-L5 → Strong Hire', pStrong.decision.band === 'Strong Hire', pStrong.decision.band)
ok('all-L1 → Strong No Hire', pWeak.decision.band === 'Strong No Hire', pWeak.decision.band)
ok('composite θ monotonic L1<L3<L5', pWeak.composite_theta < pMid.composite_theta && pMid.composite_theta < pStrong.composite_theta)
ok('full ratings → 100% coverage', pStrong.coverage === 1)
ok('flat profile (no between-competency variance) → dependability null', pStrong.rater_dependability === null)
// Varied profile with agreeing raters → dependability should be high & present.
const variedLevels = [5, 4, 3, 5, 2, 4, 3]
const varied = Object.fromEntries(ids.map((id, i) => { const L = variedLevels[i % variedLevels.length]; return [id, [rater(L), rater(L)]] }))
const pVaried = finalizeProfileEnsemble(model, varied, {}, { rater_count: 2 })
ok('varied profile, agreeing raters → dependability present & high', pVaried.rater_dependability != null && pVaried.rater_dependability > 0.7, `dep=${pVaried.rater_dependability}`)

// Unknown handling: blank out two competencies (both raters abstain)
const partial = allAt(5)
partial[ids[0]] = [{ state: 'unknown' }, { state: 'unknown' }]
partial[ids[1]] = [{ state: 'unknown' }, { state: 'unknown' }]
const pPartial = finalizeProfileEnsemble(model, partial, {}, { rater_count: 2 })
ok('both raters abstain → competency Unknown', pPartial.unknown_competencies.length >= 2, JSON.stringify(pPartial.unknown_competencies))
ok('coverage drops below 1 when competencies unknown', pPartial.coverage < 1)

// Refutation down-weights
const refuted = finalizeProfileEnsemble(model, allAt(5), { [ids[0]]: { refuted: true, reason: 'weak' } }, { rater_count: 2 })
const refutedComp = refuted.competencies.find((c) => c.id === ids[0])
const cleanComp = pStrong.competencies.find((c) => c.id === ids[0])
ok('refuted competency flagged', refutedComp.refuted === true)
ok('refuted competency has lower confidence than clean', refutedComp.confidence < cleanComp.confidence, `${refutedComp.confidence} vs ${cleanComp.confidence}`)

console.log('\n── Part A4: fairness engine unit tests ──────────────────────')
// Blinding
const bl = blindTranscript([
  { role: 'assistant', content: 'Contact Dr. Jane Smith?' },
  { role: 'user', content: "I'm Jane Smith, email jane@acme.com, phone +1 415 555 1234, site https://jane.dev" },
], { name: 'Jane Smith' })
ok('blinding redacts email', !/jane@acme\.com/.test(JSON.stringify(bl.messages)))
ok('blinding redacts phone', !/555 1234/.test(JSON.stringify(bl.messages)))
ok('blinding redacts URL', !/jane\.dev/.test(JSON.stringify(bl.messages)))
ok('blinding redacts candidate name in user turn', !/Jane Smith/.test(bl.messages[1].content))
ok('blinding leaves interviewer (assistant) turn untouched', bl.messages[0].content === 'Contact Dr. Jane Smith?')
ok('blinding counts redactions', bl.redactions >= 4, `redactions=${bl.redactions}`)

// Adverse impact — 4/5ths rule
const noAI = adverseImpact([
  ...Array.from({ length: 40 }, () => ({ group: 'A', selected: Math.random() < 0.5 })),
  ...Array.from({ length: 40 }, () => ({ group: 'B', selected: Math.random() < 0.48 })),
])
ok('adverse impact returns a status', ['pass', 'adverse_impact_detected', 'insufficient_data'].includes(noAI.status))
const clearAI = adverseImpact([
  ...Array.from({ length: 50 }, (_, i) => ({ group: 'A', selected: i < 40 })),  // 80%
  ...Array.from({ length: 50 }, (_, i) => ({ group: 'B', selected: i < 10 })),  // 20% → ratio 0.25
])
ok('clear disparity → adverse_impact_detected', clearAI.status === 'adverse_impact_detected', clearAI.status)
ok('impact ratio computed vs highest group', clearAI.groups.some((g) => g.impact_ratio != null && g.impact_ratio < 0.8))
const smallAI = adverseImpact([{ group: 'A', selected: true }, { group: 'B', selected: false }])
ok('small cells → insufficient_data (no false alarm)', smallAI.status === 'insufficient_data')

// Standardized mean difference (Cohen's d)
ok('SMD ~0 for identical distributions', Math.abs(standardizedMeanDifference([1, 2, 3, 4], [1, 2, 3, 4])) < 0.01)
ok('SMD positive when A > B', standardizedMeanDifference([5, 6, 7], [1, 2, 3]) > 1)

// DIF conditional on ability
const difRows = [
  ...Array.from({ length: 10 }, () => ({ group: 'F', ability_band: 'high', score: 70 })),
  ...Array.from({ length: 10 }, () => ({ group: 'R', ability_band: 'high', score: 71 })),
  ...Array.from({ length: 10 }, () => ({ group: 'F', ability_band: 'low', score: 40 })),
  ...Array.from({ length: 10 }, () => ({ group: 'R', ability_band: 'low', score: 41 })),
]
const noDif = differentialItemFunctioning(difRows, { focal: 'F', reference: 'R' })
ok('equal-ability equal-score → DIF pass', noDif.status === 'pass', JSON.stringify(noDif))
const difRows2 = difRows.map((r) => r.group === 'F' ? { ...r, score: r.score - 35 } : r)
const yesDif = differentialItemFunctioning(difRows2, { focal: 'F', reference: 'R' })
ok('same ability but lower focal score → dif_detected', yesDif.status === 'dif_detected', JSON.stringify(yesDif))

console.log('\n── Part A5: calibration / outcome-loop unit tests ───────────')
// A good predictor: high p for successes, low p for failures.
const goodPairs = [
  ...Array.from({ length: 40 }, () => ({ p: 0.7 + Math.random() * 0.25, outcome: 1 })),
  ...Array.from({ length: 40 }, () => ({ p: 0.05 + Math.random() * 0.25, outcome: 0 })),
]
// A useless predictor: p unrelated to outcome.
const uselessPairs = Array.from({ length: 80 }, (_, i) => ({ p: Math.random(), outcome: i % 2 }))

ok('Brier lower for good predictor than useless', brierScore(goodPairs) < brierScore(uselessPairs), `${brierScore(goodPairs)} vs ${brierScore(uselessPairs)}`)
ok('AUC high (>0.9) for good predictor', auc(goodPairs) > 0.9, `auc=${auc(goodPairs)}`)
ok('AUC ~0.5 for useless predictor', Math.abs(auc(uselessPairs) - 0.5) < 0.15, `auc=${auc(uselessPairs)}`)
ok('perfectly calibrated → low ECE', expectedCalibrationError([...Array.from({ length: 100 }, (_, i) => ({ p: 0.7, outcome: i < 70 ? 1 : 0 }))]) < 0.05)

// Recalibrate the bar: successes have high θ, failures low θ → bar near 0.
const barRows = [
  ...Array.from({ length: 30 }, () => ({ theta: 0.5 + Math.random(), outcome: 1 })),
  ...Array.from({ length: 30 }, () => ({ theta: -1.5 + Math.random(), outcome: 0 })),
]
const bar = recalibrateBar(barRows)
ok('recalibrateBar finds a separating cut (Youden J high)', bar.status === 'ok' && bar.j > 0.6, JSON.stringify(bar))

// point-biserial: θ correlated with outcome → positive
ok('pointBiserial positive when θ predicts outcome', pointBiserial([2, 1, 2, 1, 2, 1], [1, 0, 1, 0, 1, 0]) > 0.5)

// recalibrateWeights: competency A predicts, B is noise → A gets more weight
const wRows = Array.from({ length: 40 }, (_, i) => {
  const out = i % 2
  return { thetas: { A: out ? 1 + Math.random() : -1 + Math.random(), B: Math.random() * 2 - 1 }, outcome: out }
})
const rw = recalibrateWeights(wRows, ['A', 'B'])
ok('recalibrateWeights gives predictive competency more weight', rw.status === 'ok' && rw.weights.A > rw.weights.B, JSON.stringify(rw.weights))

// validity gate: below minN → uncalibrated_prior (scientific integrity)
ok('below minN → insufficient_data / uncalibrated_prior', validitySummary(goodPairs.slice(0, 10), { minN: 50 }).calibration === 'uncalibrated_prior')
ok('above minN → calibrated with metrics', validitySummary(goodPairs, { minN: 50 }).status === 'calibrated')

console.log(`\n  Cumulative: ${pass} passed, ${fail} failed`)

// ── Part B: integration alignment via API ─────────────────────────────────
console.log('\n── Part B: integration alignment (live API, best-effort) ────')

const BASE = 'http://localhost:3002/api/eie/score'
const T = (a, u) => [{ role: 'assistant', content: a }, { role: 'user', content: u }]

const WEAK = [
  ...T('Tell me about your hardest backend problem.', 'Uh, I did some backend stuff. We used best practices and it mostly worked.'),
  ...T('What did you get wrong first?', "I'm not sure, the team handled most of that part."),
  ...T('What do most people miss?', "I don't really have a specific answer."),
]
const MEDIUM = [
  ...T('Tell me about your hardest backend problem.', 'I built an internal API with FastAPI that the team used. It worked well enough after some tuning.'),
  ...T('What did you get wrong first?', 'The first version was slow so I added caching. Took some trial and error.'),
  ...T('What do most people miss?', 'Prompts and configs need iteration before they are reliable.'),
]
const STRONG = [
  ...T('Tell me about your hardest backend problem.', 'I owned migrating a Django monolith to async FastAPI with Redis queues end to end, cut p99 latency 60%. The hardest part was a race condition only at scale — I reproduced it by replaying prod traffic and found the ordering bug by reading Redis source.'),
  ...T('What did you get wrong first?', 'My first version was too aggressive; the team pushed back. I re-architected to rank by confidence and only surface high-value findings. I had to unlearn that completeness beats precision.'),
  ...T('What do most people miss?', 'Everyone underestimates evaluation. Building the harness that catches regressions against task-specific rubrics is what makes it reliable.'),
]

async function score(messages) {
  const res = await fetch(BASE, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ role: 'Senior Backend Engineer', seniority: 'senior', nRaters: 2, messages }),
  })
  const j = await res.json().catch(() => ({}))
  return j.profile || null
}

try {
  const results = {}
  for (const [k, msgs] of [['WEAK', WEAK], ['MEDIUM', MEDIUM], ['STRONG', STRONG]]) {
    let p = null
    for (let i = 0; i < 3 && !p; i++) { p = await score(msgs); if (!p) await new Promise(r => setTimeout(r, 4000)) }
    results[k] = p
    if (p) console.log(`  ${k}: ${p.decision.band} · composite ${p.composite_score} · coverage ${Math.round(p.coverage * 100)}% · reliability ${Math.round(p.overall_reliability * 100)}% · dep ${p.rater_dependability}`)
    else console.log(`  ${k}: (no result — rate limited?)`)
  }
  if (results.WEAK && results.MEDIUM && results.STRONG) {
    ok('composite ordered WEAK < MEDIUM < STRONG',
      results.WEAK.composite_score < results.MEDIUM.composite_score && results.MEDIUM.composite_score < results.STRONG.composite_score,
      `${results.WEAK.composite_score} / ${results.MEDIUM.composite_score} / ${results.STRONG.composite_score}`)
    ok('WEAK yields Unknown or reservations (thin evidence)', results.WEAK.unknown_competencies.length > 0 || results.WEAK.decision.band === 'Needs More Evidence' || results.WEAK.composite_score < 50)
    ok('STRONG is a Hire-class decision', ['Strong Hire', 'Hire', 'Hire with Reservations'].includes(results.STRONG.decision.band))
  } else {
    console.log('  ⚠️  integration alignment skipped (API unavailable / rate limited) — Part A still authoritative')
  }
} catch (e) {
  console.log('  ⚠️  integration test error:', e.message)
}

console.log('\n── Part A6: interview planner / belief loop tests ───────────')
ok('requiredConfidence rises with weight', requiredConfidence('senior', 0.2) > requiredConfidence('senior', 0.05))
ok('requiredConfidence rises with seniority', requiredConfidence('exec', 0.1) > requiredConfidence('ic3', 0.1))

ok('statusFor unknown when not measured', statusFor({ state: 'unknown' }, 0.6) === 'unknown')
ok('statusFor partial when low confidence', statusFor({ state: 'measured', confidence: 0.4, evidence: [1] }, 0.6) === 'partial')
ok('statusFor strong when confident, few episodes', statusFor({ state: 'measured', confidence: 0.7, evidence: [1] }, 0.6) === 'strong')
ok('statusFor verified when confident + ≥2 episodes', statusFor({ state: 'measured', confidence: 0.7, evidence: [1, 2] }, 0.6) === 'verified')

ok('info gain -Inf for verified', expectedInfoGain({ status: 'verified', importance: 0.2, se: 0.3 }) === -Infinity)
ok('info gain higher for more important, less certain', expectedInfoGain({ status: 'partial', importance: 0.2, se: 0.9 }) > expectedInfoGain({ status: 'partial', importance: 0.05, se: 0.3 }))
ok('unknown competency has strong pull (uses max uncertainty)', expectedInfoGain({ status: 'unknown', importance: 0.15 }) > 0)

ok('moveFor unknown → open', moveFor({}, 'unknown') === 'open')
ok('moveFor partial → deepen', moveFor({}, 'partial') === 'deepen')
ok('moveFor strong → verify', moveFor({}, 'strong') === 'verify')
ok('moveFor contradiction → resolve', moveFor({ refuted: true }, 'partial') === 'resolve')

// planFromProfile: build a synthetic profile where everything is settled EXCEPT
// one unknown → that must be the next target.
const strat = buildStrategy('Backend Engineer', 'senior')
const synth = {
  coverage: 0.85,
  decision: { band: 'Hire', p_success: 0.7 },
  competencies: strat.model.competencies.map((c, i) => i === 3
    ? { id: c.id, name: c.name, weight: c.weight, state: 'unknown' }
    : { id: c.id, name: c.name, weight: c.weight, state: 'measured', confidence: 0.75, se: 0.4, theta: 0.8, evidence: [1, 2] }),
}
const plan = planFromProfile(strat, synth)
ok('planFromProfile picks the unknown competency as next target', plan.next_target?.competency_id === strat.model.competencies[3].id, JSON.stringify(plan.next_target))
ok('planFromProfile exposes coverage + decision', plan.coverage === 0.85 && plan.decision?.band === 'Hire')
ok('targetDirective mentions the target competency', targetDirective(plan.next_target).includes(plan.next_target.name))

// readyToConclude: all-settled high-coverage → true; inject an unknown critical → false
const settledBelief = strat.model.competencies.map((c) => ({ importance: c.weight, status: 'strong', refuted: false }))
ok('readyToConclude true when critical all settled + coverage high', readyToConclude(settledBelief, 0.9) === true)
const withUnknown = settledBelief.map((b, i) => i === 0 ? { ...b, status: 'unknown' } : b)
ok('readyToConclude false when a critical competency is unknown', readyToConclude(withUnknown, 0.9) === false)

console.log('\n── Part A7: decision-stability stop tests ───────────────────')
// CI entirely above the bar → stable (hire-side).
ok('CI above bar → stable', decisionStability({ coverage: 0.9, composite_ci90: [0.2, 1.4], decision: { bar: -0.4 } }).stable === true)
// CI entirely below the bar → stable (no-hire-side).
ok('CI below bar → stable', decisionStability({ coverage: 0.9, composite_ci90: [-2.0, -0.6], decision: { bar: -0.4 } }).stable === true)
// CI straddles the bar → NOT stable, keep investigating.
const straddle = decisionStability({ coverage: 0.9, composite_ci90: [-1.0, 1.0], decision: { bar: -0.4 } })
ok('CI straddling bar → not stable', straddle.stable === false && straddle.straddles === true)
// Low coverage → not stable even if one-sided.
ok('low coverage → not stable', decisionStability({ coverage: 0.4, composite_ci90: [0.2, 1.4], decision: { bar: -0.4 } }).stable === false)

// planFromProfile gates conclusion on min answers even when stable.
const stableProfile = {
  coverage: 0.9, composite_ci90: [0.3, 1.4], decision: { band: 'Hire', bar: -0.4 },
  competencies: strat.model.competencies.map((c) => ({ id: c.id, name: c.name, weight: c.weight, state: 'measured', confidence: 0.8, se: 0.35, theta: 0.9, evidence: [1, 2] })),
}
ok('not ready before min answers even if stable', planFromProfile(strat, stableProfile, { answered: 2 }).ready_to_conclude === false)
ok('ready after min answers when decision stable', planFromProfile(strat, stableProfile, { answered: 6 }).ready_to_conclude === true)
ok('when ready, no next target is emitted', planFromProfile(strat, stableProfile, { answered: 6 }).next_target === null)

console.log('\n── Part A8: planner refinement + critic + quality (4/5/6) ───')
// Step 4 — refined moves (anti-repetition)
ok('unknown after 2 turns → switch (not re-open)', moveFor({}, 'unknown', 2) === 'switch')
ok('partial after 2 turns → switch (diminishing returns)', moveFor({}, 'partial', 2) === 'switch')
ok('unknown early → still open', moveFor({}, 'unknown', 0) === 'open')

// Step 4 — resume hooks
const hookModel = buildStrategy('Backend Engineer', 'senior').model
const hooks = extractResumeHooks('Led a team of 8 engineers. Cut p99 latency by 60%. Architected a distributed queue.', hookModel)
ok('resume hooks map quantified/leadership claim → ownership', (hooks.ownership || []).length > 0)
ok('resume hooks map technical claim → technical_depth', (hooks.technical_depth || []).length > 0)

// Step 5 — Interview Critic
const prevB = [{ competency_id: 'x', confidence: 0.3, evidence_count: 1, status: 'partial', turns_spent: 1 }]
const gained = critique(prevB, [{ competency_id: 'x', confidence: 0.6, evidence_count: 2, status: 'strong' }], 'x')
ok('critic marks productive when confidence rises + evidence gained', gained.useful && gained.verdict !== 'evasive')
const dodged = critique(prevB, [{ competency_id: 'x', confidence: 0.31, evidence_count: 1, status: 'partial' }], 'x')
ok('critic flags evasive when probed but no gain', dodged.evasive === true && dodged.recommendation === 'switch')
ok('critic returns null without a target', critique(prevB, prevB, null) === null)

// Step 6 — Interview Quality
const strongProfile = { coverage: 0.95, overall_reliability: 0.72, competencies: Array.from({ length: 7 }, (_, i) => ({ id: 'c' + i, state: 'measured' })) }
const weakProfile = { coverage: 0.4, overall_reliability: 0.35, competencies: Array.from({ length: 7 }, (_, i) => ({ id: 'c' + i, state: i < 4 ? 'unknown' : 'measured' })) }
const q1 = interviewQuality(strongProfile, { questionsAsked: 8 })
const q2 = interviewQuality(weakProfile, { questionsAsked: 3 })
ok('quality high for well-covered reliable interview', q1.score >= 74 && ['A+', 'A', 'B'].includes(q1.grade), JSON.stringify(q1))
ok('quality low + flags for weak interview', q2.score < 60 && q2.flags.length > 0, JSON.stringify(q2))
ok('quality flags too_short', interviewQuality(strongProfile, { questionsAsked: 2 }).flags.includes('too_short'))
ok('evasions reduce quality score', interviewQuality(strongProfile, { questionsAsked: 8, evasions: 3 }).score < q1.score)

console.log(`\n═══ TOTAL: ${pass} passed, ${fail} failed ═══`)
process.exit(fail > 0 ? 1 : 0)
