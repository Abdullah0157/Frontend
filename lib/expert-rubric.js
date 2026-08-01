// ─────────────────────────────────────────────────────────────────────────
// Expert Rubric Engine — the "top 1%" scoring layer for Maya's domain-expert
// interview. The point of this module is DETERMINISM and DEFENSIBILITY:
//
//   • The model scores 5 dimensions (0-10) against explicit written anchors.
//   • The overall score is NOT the model's opinion — it is a fixed weighted
//     function of those 5 dimensions, computed HERE. Same dimensions → same
//     score, every time. No drift between runs.
//   • Each dimension carries a confidence (0-1): how well the transcript
//     actually evidenced it. This is the honesty layer.
//   • Ranking (percentile within a domain) is computed from real peer scores,
//     so "top 1%" is a measured number, not a label the model asserts.
//
// Both app/api/interview/route.js (write path) and the admin views (read path)
// import from here so the math is identical everywhere.
// ─────────────────────────────────────────────────────────────────────────

// Weighted dimensions. Weights sum to 1.0. Depth and real practical experience
// dominate — that's what actually separates a genuine expert from a fluent
// talker. Communication/teaching matter but can't carry a shallow candidate.
export const DIMENSIONS = [
  { key: 'domain_depth',        label: 'Depth',       weight: 0.30 },
  { key: 'practical_experience', label: 'Practical',  weight: 0.28 },
  { key: 'problem_solving',     label: 'Problem Solving', weight: 0.22 },
  { key: 'communication',       label: 'Communication',  weight: 0.12 },
  { key: 'teaching_ability',    label: 'Teaching',    weight: 0.08 },
]

// Concrete 1-10 anchors per dimension. These go into the model prompt so the
// scores are reproducible instead of vibes. Keep them tight.
export const ANCHORS = {
  domain_depth: {
    '9-10': 'Explains internals/first principles, edge cases, and WHY things work. The tells of someone who has debugged this at the source level.',
    '7-8': 'Solid working depth; correct mental models; can go one level deeper than the surface when pushed.',
    '5-6': 'Competent but mostly applied recipes; struggles when pushed past the standard case.',
    '3-4': 'Surface familiarity; repeats common knowledge; vague under a concrete probe.',
    '1-2': 'Little real understanding; deflects or is wrong on fundamentals.',
  },
  practical_experience: {
    '9-10': 'Owned hard problems end-to-end in production; specific metrics, tradeoffs, and consequences they lived through.',
    '7-8': 'Real shipped work with concrete outcomes; clearly did the thing, not just read about it.',
    '5-6': 'Some hands-on work but thin on ownership or measurable impact.',
    '3-4': 'Mostly peripheral involvement; "the team handled that"; few specifics.',
    '1-2': 'No credible evidence of doing the work.',
  },
  problem_solving: {
    '9-10': 'Reasons crisply through ambiguity and failure; describes a wrong turn and exactly what changed their approach.',
    '7-8': 'Structured problem approach; handles edge cases and being wrong with maturity.',
    '5-6': 'Can solve standard problems; less convincing on novel/edge situations.',
    '3-4': 'Formulaic; little evidence of debugging or adapting when things break.',
    '1-2': 'No demonstrated reasoning under difficulty.',
  },
  communication: {
    '9-10': 'Makes a complex idea click fast; precise, well-structured, no waffle.',
    '7-8': 'Clear and easy to follow; organizes thoughts well.',
    '5-6': 'Understandable but rambling or imprecise at times.',
    '3-4': 'Hard to follow; vague; buries the point.',
    '1-2': 'Cannot articulate their own work clearly.',
  },
  teaching_ability: {
    '9-10': 'Naturally teaches — analogies, right altitude, anticipates the listener\'s confusion.',
    '7-8': 'Explains to others well; adjusts detail to the audience.',
    '5-6': 'Can explain but stays at one level; some jargon dumps.',
    '3-4': 'Struggles to make it land for anyone but themselves.',
    '1-2': 'No teaching signal.',
  },
}

// Renders the anchor guide as prompt text.
export function anchorGuideText() {
  return DIMENSIONS.map((d) => {
    const a = ANCHORS[d.key]
    const bands = Object.entries(a).map(([band, desc]) => `    ${band}: ${desc}`).join('\n')
    return `  ${d.key} (weight ${Math.round(d.weight * 100)}%):\n${bands}`
  }).join('\n')
}

const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n))

// Deterministic overall score (0-10, one decimal) = weighted mean of the 5
// dimension scores. THIS is the source of truth for expertise_score.
export function compositeScore(internal) {
  let sum = 0, wsum = 0
  for (const d of DIMENSIONS) {
    const v = Number(internal?.[d.key])
    if (Number.isFinite(v)) { sum += clamp(v, 0, 10) * d.weight; wsum += d.weight }
  }
  if (!wsum) return null
  return Math.round((sum / wsum) * 10) / 10
}

// Level bands aligned to the calibration (7 solid, 8 strong, 9 exceptional).
export function levelFromScore(s) {
  if (s == null) return null
  if (s >= 9.0) return 'master'
  if (s >= 8.0) return 'expert'
  if (s >= 6.5) return 'advanced'
  if (s >= 5.0) return 'proficient'
  if (s >= 3.5) return 'developing'
  return 'beginner'
}

// Weighted overall confidence (0-1) from per-dimension confidences.
export function overallConfidence(conf) {
  let sum = 0, wsum = 0
  for (const d of DIMENSIONS) {
    const v = Number(conf?.[d.key])
    if (Number.isFinite(v)) { sum += clamp(v, 0, 1) * d.weight; wsum += d.weight }
  }
  if (!wsum) return null
  return Math.round((sum / wsum) * 100) / 100
}

// Takes a raw model report and returns it with a deterministic, defensible
// scoring block attached (overriding any model-provided overall score).
export function finalizeReport(report) {
  if (!report || typeof report !== 'object') return report
  const internal = report.internal_scores || {}
  const conf = report.score_confidence || {}
  const composite = compositeScore(internal)
  if (composite != null) {
    report.expertise_score = composite            // deterministic override
    report.expertise_level = levelFromScore(composite)
  }
  report.overall_confidence = overallConfidence(conf)
  report.rubric_version = 'expert-v2'
  return report
}

// Percentile rank of `score` within `peers` (array of numbers), 0-100.
// "Top X%" = 100 - percentile. Uses <= so ties don't over-credit.
export function percentileRank(score, peers) {
  const xs = (peers || []).filter((n) => Number.isFinite(Number(n))).map(Number)
  if (score == null || xs.length === 0) return null
  const below = xs.filter((n) => n <= score).length
  return Math.round((below / xs.length) * 100)
}

// Human "Top N%" label from a percentile (e.g. p=98 → "Top 2%").
export function topLabel(percentile) {
  if (percentile == null) return null
  const top = Math.max(1, 100 - percentile)
  return `Top ${top}%`
}
