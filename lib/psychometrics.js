// ─────────────────────────────────────────────────────────────────────────
// Psychometrics core — EIE Phase 2 (Measurement Engine)
// Turns an ordered BARS rating into a Bayesian posterior over a latent ability
// θ using Samejima's Graded Response Model (GRM) with EAP estimation over a
// fixed θ-grid. Outputs a point estimate, a credible interval (honest
// uncertainty), a norm-percentile, and marginal reliability.
//
// Why this and not "level×20": a point score hides how well we actually
// measured the person. A confident, well-evidenced L4 and a hand-wavy L4 must
// NOT look identical — here the second gets a wide credible interval. This is
// the single biggest scientific upgrade over every "AI scoring" competitor.
//
// See EVALUATION_ENGINE.md §4. Real multi-rater G-theory reliability lands in
// Phase 3; here reliability is the IRT *marginal* reliability (variance
// reduction vs the prior), which is the correct single-rater analogue.
// ─────────────────────────────────────────────────────────────────────────

// Standard-normal pdf / cdf (Abramowitz & Stegun 7.1.26 erf approximation).
function normalPdf(z) {
  return Math.exp(-0.5 * z * z) / Math.sqrt(2 * Math.PI)
}
export function normalCdf(z) {
  const t = 1 / (1 + 0.2316419 * Math.abs(z))
  const d = 0.3989423 * Math.exp(-z * z / 2)
  let p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))))
  return z > 0 ? 1 - p : p
}

const logistic = (x) => 1 / (1 + Math.exp(-x))
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n))

// θ grid: -4..4 step 0.1 (81 points). Fixed → deterministic, fast, no sampler.
const GRID = Array.from({ length: 81 }, (_, i) => -4 + i * 0.1)

// Default GRM parameters (theory-set; refit from data in Phase 6).
//  - discrimination a: how sharply the anchors separate ability.
//  - thresholds: the 4 category boundaries between the 5 BARS levels on the θ
//    scale. Symmetric around 0 so L3 ≈ population median, L5 ≈ +1.8 SD.
export const DEFAULT_A = 2.0
export const DEFAULT_THRESHOLDS = [-1.5, -0.5, 0.5, 1.5]

// P(response == level | θ) under the GRM.
function categoryProb(level, theta, a, thr) {
  const pge = (k) => (k <= 1 ? 1 : k >= 6 ? 0 : logistic(a * (theta - thr[k - 2])))
  return clamp(pge(level) - pge(level + 1), 1e-9, 1)
}

// Bayesian posterior over θ for a single observed BARS `level`.
//  weight ∈ (0,1] = rater confidence → tempers the likelihood (low confidence
//  ⇒ near-flat likelihood ⇒ posterior ≈ prior ⇒ wide credible interval).
// `weight` is the effective number of (confidence-scaled) observations of θ —
// under local independence, multiple cited behavioral episodes each inform θ,
// so weight can exceed 1 (more evidence ⇒ sharper posterior ⇒ tighter CI).
export function grmPosterior({ level, weight = 1, a = DEFAULT_A, thresholds = DEFAULT_THRESHOLDS, priorMean = 0, priorSD = 1 }) {
  const w = clamp(weight, 0.05, 3.5)
  const unnorm = GRID.map((t) => {
    const prior = normalPdf((t - priorMean) / priorSD)
    const lik = categoryProb(level, t, a, thresholds)
    return prior * Math.pow(lik, w)
  })
  const Z = unnorm.reduce((s, x) => s + x, 0) || 1
  const post = unnorm.map((x) => x / Z)

  const theta = GRID.reduce((s, t, i) => s + t * post[i], 0)
  const variance = GRID.reduce((s, t, i) => s + (t - theta) ** 2 * post[i], 0)
  const se = Math.sqrt(variance)

  // 90% credible interval from the posterior CDF over the grid.
  const ci90 = [quantile(post, 0.05), quantile(post, 0.95)]

  // IRT marginal reliability: 1 − (posterior var / prior var).
  const reliability = clamp(1 - variance / (priorSD * priorSD), 0, 1)

  return {
    theta: round(theta, 2),
    se: round(se, 2),
    ci90: [round(ci90[0], 2), round(ci90[1], 2)],
    reliability: round(reliability, 2),
    percentile: Math.round(normalCdf(theta) * 100), // norm-population percentile
  }
}

// Multi-observation posterior — the Phase 3 core. Each observation is one
// rater's BARS level (with its own weight). Under local independence the
// likelihood is the product over observations, so AGREEING raters sharpen the
// posterior (tight CI, high reliability) and DISAGREEING raters flatten it
// (wide CI, low reliability). Rater disagreement thus becomes honest uncertainty
// automatically — no ad-hoc penalty needed. See EVALUATION_ENGINE.md §4.6.
export function grmPosteriorMulti({ observations, a = DEFAULT_A, thresholds = DEFAULT_THRESHOLDS, priorMean = 0, priorSD = 1 }) {
  const obs = (observations || []).filter((o) => Number.isFinite(o.level))
  if (!obs.length) return null
  const unnorm = GRID.map((t) => {
    let logp = Math.log(normalPdf((t - priorMean) / priorSD) + 1e-300)
    for (const o of obs) {
      const w = clamp(o.weight ?? 1, 0.02, 3.5)
      logp += w * Math.log(categoryProb(o.level, t, a, thresholds))
    }
    return Math.exp(logp)
  })
  const Z = unnorm.reduce((s, x) => s + x, 0) || 1
  const post = unnorm.map((x) => x / Z)

  const theta = GRID.reduce((s, t, i) => s + t * post[i], 0)
  const variance = GRID.reduce((s, t, i) => s + (t - theta) ** 2 * post[i], 0)
  const se = Math.sqrt(variance)
  const ci90 = [quantile(post, 0.05), quantile(post, 0.95)]
  const reliability = clamp(1 - variance / (priorSD * priorSD), 0, 1)
  return {
    theta: round(theta, 2), se: round(se, 2),
    ci90: [round(ci90[0], 2), round(ci90[1], 2)],
    reliability: round(reliability, 2),
    percentile: Math.round(normalCdf(theta) * 100),
  }
}

// Exact-agreement-style rater agreement for a set of BARS levels (0..1):
// 1 − (mean absolute deviation from the modal level / max possible deviation).
export function raterAgreement(levels) {
  const xs = (levels || []).filter((n) => Number.isFinite(n))
  if (xs.length < 2) return null
  const mean = xs.reduce((s, x) => s + x, 0) / xs.length
  const mad = xs.reduce((s, x) => s + Math.abs(x - mean), 0) / xs.length
  return round(clamp(1 - mad / 2, 0, 1), 2) // 2 = half the 1..5 range
}

// Two-way (competency × rater) variance decomposition on a level matrix →
// a G-theory dependability for the candidate's PROFILE against rater swaps.
// matrix: rows = competencies, cols = raters (equal length rows).
export function profileDependability(matrix) {
  const rows = (matrix || []).filter((r) => Array.isArray(r) && r.length)
  const nC = rows.length
  const nR = rows[0]?.length || 0
  if (nC < 2 || nR < 2) return null
  const grand = rows.flat().reduce((s, x) => s + x, 0) / (nC * nR)
  const compMeans = rows.map((r) => r.reduce((s, x) => s + x, 0) / nR)
  const raterMeans = Array.from({ length: nR }, (_, j) => rows.reduce((s, r) => s + r[j], 0) / nC)

  let ssC = 0, ssR = 0, ssE = 0
  for (let i = 0; i < nC; i++) {
    ssC += nR * (compMeans[i] - grand) ** 2
    for (let j = 0; j < nR; j++) {
      const resid = rows[i][j] - compMeans[i] - raterMeans[j] + grand
      ssE += resid * resid
    }
  }
  for (let j = 0; j < nR; j++) ssR += nC * (raterMeans[j] - grand) ** 2
  const vComp = Math.max(0, ssC / (nC - 1) - ssE / ((nC - 1) * (nR - 1))) // simplified EMS
  const vRater = Math.max(0, ssR / (nR - 1))
  const vResid = Math.max(1e-6, ssE / ((nC - 1) * (nR - 1)))
  // Dependability is undefined when there is no between-competency (true-score)
  // variance — a flat profile means "nothing to differentiate", NOT "unreliable".
  const dependability = vComp < 1e-3 ? null : round(clamp(vComp / (vComp + (vRater + vResid) / nR), 0, 1), 2)
  return { vComp: round(vComp, 3), vRater: round(vRater, 3), vResid: round(vResid, 3), dependability }
}

function quantile(post, q) {
  let cum = 0
  for (let i = 0; i < GRID.length; i++) {
    cum += post[i]
    if (cum >= q) return GRID[i]
  }
  return GRID[GRID.length - 1]
}

function round(n, d) {
  const f = 10 ** d
  return Math.round(n * f) / f
}

// Combine per-competency posteriors into a weighted composite θ with correct
// error propagation. weights need not sum to 1 (normalized internally).
export function compositePosterior(items) {
  // items: [{ theta, se, weight }]
  const measured = items.filter((x) => Number.isFinite(x.theta) && x.weight > 0)
  if (!measured.length) return null
  const W = measured.reduce((s, x) => s + x.weight, 0)
  const theta = measured.reduce((s, x) => s + (x.weight / W) * x.theta, 0)
  const variance = measured.reduce((s, x) => s + ((x.weight / W) ** 2) * (x.se * x.se), 0)
  const se = Math.sqrt(variance)
  return {
    theta: round(theta, 2),
    se: round(se, 2),
    ci90: [round(theta - 1.645 * se, 2), round(theta + 1.645 * se, 2)],
    percentile: Math.round(normalCdf(theta) * 100),
  }
}

// Seniority base-rate prior mean (weak, non-zero information). Senior norm = 0.
export function priorMeanForSeniority(seniority) {
  return { ic3: -0.3, senior: 0, staff: 0.2, exec: 0.3 }[seniority] ?? 0
}
