// ─────────────────────────────────────────────────────────────────────────
// Fairness & Validity — EIE Phase 5
// Makes the engine legally/ethically defensible:
//   • blinding: redact identity cues before the rater ever sees the transcript
//   • adverse impact: the EEOC 4/5ths rule on selection rates by group
//   • DIF: does equal ability yield equal ratings across groups?
//   • bias-audit export: the summary NYC Local Law 144 requires annually
//
// The computations are pure and unit-tested. They run over cohorts of stored
// decisions once demographic data is available (via HRIS integration — it is
// NEVER elicited in the interview itself). See EVALUATION_ENGINE.md §8.
// ─────────────────────────────────────────────────────────────────────────

const round = (n, d = 2) => { const f = 10 ** d; return Math.round(n * f) / f }

// ── Blinding ───────────────────────────────────────────────────────────────
// Redact identity cues from CANDIDATE turns before rating (interviewer turns are
// left intact). v1 covers the high-signal leaks: email, phone, URL, and the
// candidate's known name + honorifics. NER-based redaction (schools, locations)
// is a future enhancement; we log what we could not blind rather than pretend.
const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g
const PHONE = /(?:\+?\d[\d\s().-]{7,}\d)/g
const URL = /\bhttps?:\/\/\S+|\bwww\.\S+/gi
const HONORIFIC = /\b(mr|mrs|ms|miss|mx|dr|prof)\.?\s+[A-Z][a-z]+/g

export function blindTranscript(messages, { name } = {}) {
  let redactions = 0
  const nameRe = name
    ? new RegExp(`\\b${name.trim().split(/\s+/).map((p) => p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('\\s+')}\\b`, 'gi')
    : null
  const redact = (text) => {
    let t = String(text || '')
    const sub = (re, tag) => { t = t.replace(re, () => { redactions++; return tag }) }
    sub(EMAIL, '[email]')
    sub(URL, '[url]')
    sub(PHONE, '[phone]')
    sub(HONORIFIC, '[name]')
    if (nameRe) sub(nameRe, '[name]')
    return t
  }
  const blinded = (messages || []).map((m) =>
    m.role === 'assistant' ? m : { ...m, content: redact(m.content) }
  )
  return { messages: blinded, redactions }
}

// ── Adverse impact — the 4/5ths rule ───────────────────────────────────────
// rows: [{ group, selected: boolean }]. minCell = min group size for a reliable
// read (EEOC guidance leans on adequate sample sizes).
export function adverseImpact(rows, { minCell = 30, threshold = 0.8 } = {}) {
  const g = {}
  for (const r of rows || []) {
    const k = r.group ?? 'unknown'
    g[k] ||= { n: 0, selected: 0 }
    g[k].n++
    if (r.selected) g[k].selected++
  }
  const groups = Object.entries(g).map(([group, v]) => ({ group, n: v.n, selected: v.selected, rate: v.n ? round(v.selected / v.n, 3) : 0 }))
  if (groups.length < 2) return { status: 'insufficient_groups', groups }
  const maxRate = Math.max(...groups.map((x) => x.rate))
  groups.forEach((x) => {
    x.impact_ratio = maxRate > 0 ? round(x.rate / maxRate, 3) : null
    x.flag = x.impact_ratio != null && x.impact_ratio < threshold
  })
  const smallCells = groups.some((x) => x.n < minCell)
  const anyFlag = groups.some((x) => x.flag)
  return {
    status: smallCells ? 'insufficient_data' : (anyFlag ? 'adverse_impact_detected' : 'pass'),
    rule: '4/5ths',
    max_rate: round(maxRate, 3),
    groups: groups.sort((a, b) => b.rate - a.rate),
  }
}

// ── Effect size between two groups on a competency score (Cohen's d) ────────
export function standardizedMeanDifference(a, b) {
  const A = (a || []).filter(Number.isFinite), B = (b || []).filter(Number.isFinite)
  if (A.length < 2 || B.length < 2) return null
  const mean = (x) => x.reduce((s, v) => s + v, 0) / x.length
  const varc = (x, m) => x.reduce((s, v) => s + (v - m) ** 2, 0) / (x.length - 1)
  const mA = mean(A), mB = mean(B)
  const pooled = Math.sqrt(((A.length - 1) * varc(A, mA) + (B.length - 1) * varc(B, mB)) / (A.length + B.length - 2))
  return pooled > 0 ? round((mA - mB) / pooled, 3) : 0
}

// ── DIF: is equal ability rated equally across groups? ─────────────────────
// rows: [{ group, ability_band, score }]. We compare focal vs reference score
// CONDITIONAL on ability band (the Mantel-Haenszel idea: control for true ability
// before attributing a gap to bias). Returns a band-weighted mean gap + flag.
export function differentialItemFunctioning(rows, { focal, reference, flagAt = 0.3 } = {}) {
  const bands = {}
  for (const r of rows || []) {
    if (r.group !== focal && r.group !== reference) continue
    const b = r.ability_band ?? 'na'
    bands[b] ||= { focal: [], reference: [] }
    if (r.group === focal) bands[b].focal.push(r.score)
    else bands[b].reference.push(r.score)
  }
  let wsum = 0, gapSum = 0
  const perBand = []
  for (const [band, v] of Object.entries(bands)) {
    if (v.focal.length < 2 || v.reference.length < 2) continue
    const mean = (x) => x.reduce((s, y) => s + y, 0) / x.length
    const gap = round(mean(v.focal) - mean(v.reference), 2) // score points, same-ability
    const w = v.focal.length + v.reference.length
    perBand.push({ band, gap, n: w })
    wsum += w; gapSum += gap * w
  }
  if (wsum === 0) return { status: 'insufficient_data', per_band: perBand }
  const conditionalGap = round(gapSum / wsum, 2)
  return {
    status: Math.abs(conditionalGap) >= flagAt * 100 ? 'dif_detected' : 'pass',
    conditional_gap: conditionalGap, // focal − reference at equal ability (0–100 scale)
    per_band: perBand,
  }
}

// ── Bias-audit export (LL144-style summary) ────────────────────────────────
export function biasAuditSummary({ decisions = [], groupField = 'group', selectPredicate } = {}) {
  const isSelected = selectPredicate || ((d) => ['Strong Hire', 'Hire', 'Hire with Reservations'].includes(d.band))
  const rows = decisions.map((d) => ({ group: d[groupField], selected: isSelected(d) }))
  return {
    generated_for: 'NYC Local Law 144 style bias audit',
    n: decisions.length,
    adverse_impact: adverseImpact(rows),
    note: 'Protected-class labels are supplied via HRIS integration and are never elicited during the interview. Ratings are produced on identity-blinded transcripts.',
  }
}
