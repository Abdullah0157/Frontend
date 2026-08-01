// ─────────────────────────────────────────────────────────────────────────
// Calibration & Outcome Loop — EIE Phase 6 (the compounding moat)
// Once real hire outcomes accrue, this measures whether our predictions were
// actually valid, and RECALIBRATES the engine against ground truth:
//   • predictive validity: Brier score, AUC, calibration curve / ECE
//   • recalibrate the decision bar (θ cut) to maximize outcome agreement
//   • recalibrate competency weights from their empirical link to outcomes
//     (point-biserial correlation → normalized weights)
//
// Until enough outcomes exist, everything is labeled `insufficient_data` and the
// engine keeps its theory-based priors. We NEVER claim validity we haven't
// earned. This is the moat: it needs YOUR accumulating outcome data, which no
// competitor has. See EVALUATION_ENGINE.md §10.
// ─────────────────────────────────────────────────────────────────────────

const round = (n, d = 3) => { const f = 10 ** d; return Math.round(n * f) / f }
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n))

// Brier score = mean squared error of probabilistic predictions (lower = better;
// 0 perfect, 0.25 = coin flip at p=0.5).
export function brierScore(pairs) {
  const xs = (pairs || []).filter((p) => Number.isFinite(p.p) && (p.outcome === 0 || p.outcome === 1))
  if (!xs.length) return null
  return round(xs.reduce((s, p) => s + (p.p - p.outcome) ** 2, 0) / xs.length)
}

// AUC via the Mann–Whitney U statistic (probability a random positive is ranked
// above a random negative). 0.5 = no discrimination, 1.0 = perfect.
export function auc(pairs) {
  const pos = pairs.filter((p) => p.outcome === 1).map((p) => p.p)
  const neg = pairs.filter((p) => p.outcome === 0).map((p) => p.p)
  if (!pos.length || !neg.length) return null
  let wins = 0
  for (const a of pos) for (const b of neg) wins += a > b ? 1 : a === b ? 0.5 : 0
  return round(wins / (pos.length * neg.length))
}

// Reliability diagram: bin predictions, compare predicted vs observed rate.
export function calibrationCurve(pairs, bins = 10) {
  const buckets = Array.from({ length: bins }, () => ({ sumP: 0, sumO: 0, n: 0 }))
  for (const p of pairs) {
    if (!Number.isFinite(p.p)) continue
    const b = clamp(Math.floor(p.p * bins), 0, bins - 1)
    buckets[b].sumP += p.p; buckets[b].sumO += p.outcome; buckets[b].n++
  }
  return buckets.map((b, i) => ({
    bin: `${round(i / bins, 2)}-${round((i + 1) / bins, 2)}`,
    n: b.n,
    predicted: b.n ? round(b.sumP / b.n) : null,
    observed: b.n ? round(b.sumO / b.n) : null,
  })).filter((b) => b.n > 0)
}

// Expected Calibration Error = sample-weighted |predicted − observed|.
export function expectedCalibrationError(pairs, bins = 10) {
  const curve = calibrationCurve(pairs, bins)
  const N = pairs.filter((p) => Number.isFinite(p.p)).length
  if (!N) return null
  return round(curve.reduce((s, b) => s + (b.n / N) * Math.abs(b.predicted - b.observed), 0))
}

// Recalibrate the decision bar: choose the θ cut maximizing Youden's J
// (TPR − FPR) against outcomes. rows: [{ theta, outcome }].
export function recalibrateBar(rows) {
  const xs = (rows || []).filter((r) => Number.isFinite(r.theta) && (r.outcome === 0 || r.outcome === 1))
  if (xs.length < 10) return { status: 'insufficient_data', n: xs.length }
  const P = xs.filter((r) => r.outcome === 1).length
  const Nn = xs.length - P
  if (!P || !Nn) return { status: 'insufficient_data', n: xs.length }
  const candidates = [...new Set(xs.map((r) => r.theta))].sort((a, b) => a - b)
  let best = { bar: candidates[0], j: -1, accuracy: 0 }
  for (const bar of candidates) {
    const tp = xs.filter((r) => r.theta >= bar && r.outcome === 1).length
    const fp = xs.filter((r) => r.theta >= bar && r.outcome === 0).length
    const j = tp / P - fp / Nn
    const acc = (tp + (Nn - fp)) / xs.length
    if (j > best.j) best = { bar: round(bar, 2), j: round(j), accuracy: round(acc) }
  }
  return { status: 'ok', ...best, n: xs.length }
}

// Point-biserial correlation between a continuous x and a binary y.
export function pointBiserial(x, y) {
  const pairs = x.map((v, i) => [v, y[i]]).filter(([a, b]) => Number.isFinite(a) && (b === 0 || b === 1))
  if (pairs.length < 3) return null
  const xs = pairs.map((p) => p[0]), ys = pairs.map((p) => p[1])
  const mean = (a) => a.reduce((s, v) => s + v, 0) / a.length
  const mx = mean(xs), n = xs.length
  const sd = Math.sqrt(xs.reduce((s, v) => s + (v - mx) ** 2, 0) / n)
  if (sd === 0) return 0
  const p1 = ys.filter((v) => v === 1)
  const m1 = mean(pairs.filter((p) => p[1] === 1).map((p) => p[0]))
  const m0 = mean(pairs.filter((p) => p[1] === 0).map((p) => p[0]))
  const prop = p1.length / n
  if (prop === 0 || prop === 1) return 0
  return round(((m1 - m0) / sd) * Math.sqrt(prop * (1 - prop)))
}

// Recalibrate competency weights from their empirical link to outcomes.
// rows: [{ thetas: {competency_id: theta}, outcome }]. Weight ∝ max(0, r_pb).
export function recalibrateWeights(rows, competencyIds) {
  const xs = (rows || []).filter((r) => r && r.thetas && (r.outcome === 0 || r.outcome === 1))
  if (xs.length < 20) return { status: 'insufficient_data', n: xs.length }
  const y = xs.map((r) => r.outcome)
  const raw = {}
  for (const id of competencyIds) {
    const x = xs.map((r) => r.thetas[id])
    if (x.some((v) => !Number.isFinite(v))) { raw[id] = 0; continue }
    raw[id] = Math.max(0, pointBiserial(x, y) ?? 0)
  }
  const total = Object.values(raw).reduce((s, v) => s + v, 0)
  if (total === 0) return { status: 'no_signal', n: xs.length }
  const weights = {}
  for (const id of competencyIds) weights[id] = round(raw[id] / total)
  return { status: 'ok', n: xs.length, weights, correlations: raw }
}

// Overall predictive-validity summary + calibration status gate.
export function validitySummary(pairs, { minN = 50 } = {}) {
  const xs = (pairs || []).filter((p) => Number.isFinite(p.p) && (p.outcome === 0 || p.outcome === 1))
  if (xs.length < minN) {
    return { status: 'insufficient_data', n: xs.length, needed: minN, calibration: 'uncalibrated_prior' }
  }
  return {
    status: 'calibrated',
    n: xs.length,
    calibration: 'calibrated',
    brier: brierScore(xs),
    auc: auc(xs),
    ece: expectedCalibrationError(xs),
    curve: calibrationCurve(xs),
  }
}
