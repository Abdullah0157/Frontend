// ─────────────────────────────────────────────────────────────────────────
// Interview Quality — DEIE step 6 (Maya's report card)
// Grades the INTERVIEW, not the candidate: did the interviewer actually extract
// enough well-evidenced signal to support a decision, efficiently?
//   quality = coverage × reliability × efficiency, penalized for unknowns/evasion.
// This is how you prove the AI interviewer is "up to the mark" and flag weak runs.
// See INTERVIEWER_ENGINE.md §1 (Critic) / §16.
// ─────────────────────────────────────────────────────────────────────────

const round = (n, d = 2) => { const f = 10 ** d; return Math.round(n * f) / f }
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n))

function grade(score) {
  if (score >= 90) return 'A+'
  if (score >= 82) return 'A'
  if (score >= 74) return 'B'
  if (score >= 64) return 'C'
  if (score >= 50) return 'D'
  return 'F'
}

// profile = finalized EIE profile. meta = { questionsAsked, evasions }.
export function interviewQuality(profile, { questionsAsked = 0, evasions = 0 } = {}) {
  const cov = clamp(profile?.coverage ?? 0, 0, 1)
  const rel = clamp(profile?.overall_reliability ?? 0, 0, 1)
  const comps = profile?.competencies || []
  const total = comps.length || 1
  const unknowns = comps.filter((c) => c.state === 'unknown').length
  const unknownRatio = unknowns / total

  // Efficiency: coverage achieved per question, normalized so that reaching full
  // coverage in ~8 good questions scores 1.0. Rewards getting the signal without
  // dragging the interview out — and penalizes long interviews with little to show.
  const efficiency = questionsAsked > 0 ? clamp(cov / (questionsAsked / 8), 0, 1) : 0

  // Penalties: unresolved evasion (candidate dodged and Maya didn't recover) and
  // an interview too short to be credible.
  const evasionPenalty = clamp(evasions * 0.05, 0, 0.2)
  const tooShort = questionsAsked > 0 && questionsAsked < 4

  let score = 100 * (0.40 * cov + 0.35 * rel + 0.15 * efficiency + 0.10 * (1 - unknownRatio))
  score = score * (1 - evasionPenalty)
  if (tooShort) score *= 0.75
  score = Math.round(clamp(score, 0, 100))

  const flags = []
  if (cov < 0.7) flags.push('low_coverage')
  if (rel < 0.5) flags.push('low_reliability')
  if (unknownRatio > 0.3) flags.push('many_unknowns')
  if (tooShort) flags.push('too_short')
  if (evasions > 0) flags.push('unresolved_evasion')

  return {
    score,
    grade: grade(score),
    coverage: round(cov),
    reliability: round(rel),
    efficiency: round(efficiency),
    unknown_ratio: round(unknownRatio),
    questions_asked: questionsAsked,
    evasions,
    flags,
    // A one-line, plain-English verdict for the admin UI.
    verdict: flags.length === 0
      ? 'Strong interview, well evidenced across the board.'
      : `Summary: ${flags.map((f) => ({
          low_coverage: 'the interview barely covered the skills we test',
          low_reliability: 'the results are not reliable',
          many_unknowns: 'too many areas were left unanswered',
          too_short: 'the interview was too short',
          unresolved_evasion: 'an answer looked evasive',
        }[f] || f.replace(/_/g, ' '))).join('; ')}.`,
  }
}
