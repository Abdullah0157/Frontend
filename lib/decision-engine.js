// ─────────────────────────────────────────────────────────────────────────
// Decision Engine — EIE Phase 4
// Turns the composite θ posterior into a defensible hiring decision using
// decision theory instead of arbitrary score bands:
//
//   • "Success" = the candidate's true ability clears a role/seniority BAR (τ).
//   • P(success) = P(θ ≥ τ | posterior)  — integrates the FULL uncertainty, so a
//     wide credible interval near the bar yields a middling probability, not a
//     false-confident verdict.
//   • Bayes-optimal action: HIRE when P(success) ≥ cost threshold
//         c* = cost(bad hire) / (cost(bad hire) + cost(missed good hire))
//     (signal-detection / Cronbach-Gleser utility logic).
//   • 7 bands map from P(success), with "Needs More Evidence" gated on coverage.
//
// SCIENTIFIC INTEGRITY: until outcome data calibrates τ (Phase 6), the bar is a
// LABELED PRIOR ASSUMPTION (calibration: 'uncalibrated_prior'), not a validated
// predictor. We never claim predictive validity we have not earned.
// See EVALUATION_ENGINE.md §9.
// ─────────────────────────────────────────────────────────────────────────

import { normalCdf } from './psychometrics.js'

// Ability bar τ (in θ units) a candidate must clear to "succeed" at this
// seniority. LABELED PRIOR — configurable per org, calibrated later.
export const DEFAULT_BAR = { ic3: -0.3, senior: 0.1, staff: 0.4, exec: 0.6 }

// Model-uncertainty floor added (in quadrature) to the measurement SE when
// computing P(success). The composite is measured tightly (many competencies),
// which would make P(success) a near-step function that saturates at ~100% for
// anyone above the bar. This floor reflects that the WHOLE model is not yet
// outcome-calibrated, so P(success) degrades gracefully and stays honest.
const MODEL_SE_FLOOR = 0.35

// Default cost model: a bad hire is ~2× as costly as missing a good candidate
// (typical for high-trust roles) → threshold ≈ 0.67. Configurable per org.
export const DEFAULT_COST = { bad_hire: 2, missed_good: 1 }

const round = (n, d = 2) => { const f = 10 ** d; return Math.round(n * f) / f }
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n))

export function barForSeniority(seniority, override) {
  if (Number.isFinite(override)) return override
  return DEFAULT_BAR[seniority] ?? 0
}

export function costThreshold(cost = DEFAULT_COST) {
  const b = cost.bad_hire ?? 2, m = cost.missed_good ?? 1
  return b / (b + m)
}

// P(θ ≥ bar | posterior N(theta, se)), with a model-uncertainty floor so the
// probability doesn't saturate when the measurement is tight.
export function probabilityOfSuccess(theta, se, bar) {
  if (!Number.isFinite(theta) || !Number.isFinite(se) || se < 0) return null
  const seDecision = Math.sqrt(se * se + MODEL_SE_FLOOR * MODEL_SE_FLOOR)
  return round(1 - normalCdf((bar - theta) / seDecision), 2)
}

// Ability percentile (0–100) of the composite θ in the norm population.
function abilityPercentile(theta) {
  return Math.round(normalCdf(theta) * 100)
}

// The full decision. Inputs: composite posterior (theta, se), coverage,
// critical failure names, seniority, and optional org config.
export function decideHire({ theta, se, coverage, criticalFailures = [], seniority = 'senior', barOverride, cost = DEFAULT_COST }) {
  const bar = barForSeniority(seniority, barOverride)
  const c = round(costThreshold(cost), 2)

  // Coverage gate: too little of the decision weight measured → don't pretend.
  if (!Number.isFinite(theta) || coverage < 0.6) {
    return {
      band: 'Needs More Evidence',
      p_success: probabilityOfSuccess(theta, se, bar),
      bar, cost_threshold: c, calibration: 'uncalibrated_prior',
      reason: `The candidate gave enough proof on only ${Math.round((coverage || 0) * 100)}% of the important skills, which is not enough to make a hiring call.`,
    }
  }
  if (criticalFailures.length > 0) {
    return {
      band: 'Strong No Hire',
      p_success: probabilityOfSuccess(theta, se, bar),
      bar, cost_threshold: c, calibration: 'uncalibrated_prior',
      reason: `Critical failure signal in: ${criticalFailures.join(', ')}.`,
    }
  }

  const p = probabilityOfSuccess(theta, se, bar)
  // Band on the ability PERCENTILE — a robustly-ordered metric — rather than on
  // the tight probability (which saturates). P(success) is still reported.
  const pct = abilityPercentile(theta)
  let band
  if (pct >= 68) band = 'Strong Hire'
  else if (pct >= 60) band = 'Hire'
  else if (pct >= 52) band = 'Hire with Reservations'
  else if (pct >= 44) band = 'Borderline'
  else if (pct >= 30) band = 'No Hire'
  else band = 'Strong No Hire'

  // Strong Hire additionally requires solid coverage (don't over-credit a
  // narrow-but-glowing read).
  if (band === 'Strong Hire' && coverage < 0.8) band = 'Hire'

  return {
    band,
    p_success: p,
    percentile: pct,
    meets_bar: p >= c,
    bar,
    cost_threshold: c,
    coverage: round(coverage, 2),
    calibration: 'uncalibrated_prior',
    reason: `Ability percentile ${pct} · P(clears bar θ≥${bar}) = ${Math.round(p * 100)}%, at ${Math.round(coverage * 100)}% coverage.`,
  }
}
