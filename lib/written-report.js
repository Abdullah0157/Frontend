// Report maths for the written assessment: section scores, the weighted
// overall, the band and the skill map. Pure (no I/O) so it is unit-tested.

import { bandFor } from './assessment-blueprint.js'

const SKILL_LEVEL = (s) => (s >= 0.75 ? 'strong' : s >= 0.5 ? 'ok' : 'weak')

export function summariseResponses(form, responses) {
  const bySection = new Map(form.sections.map((s) => [s.key, []]))
  for (const r of responses) bySection.get(r.section)?.push(r)

  const flags = []
  const sections = form.sections.map((s) => {
    const rs = bySection.get(s.key) || []
    const scored = rs.filter((r) => r.score != null)
    const failed = rs.length - scored.length
    if (failed > 0) flags.push({ kind: 'not_scored', section: s.key, count: failed })
    for (const r of rs) {
      if (r.ai_evaluation?.needs_human_review) flags.push({ kind: 'markers_disagree', section: s.key, responseId: r.id })
      if (r.ai_evaluation?.tests?.infra_error) flags.push({ kind: 'tests_not_run', section: s.key, responseId: r.id })
    }
    // Items never reached count as 0: they were planned and unanswered.
    const planned = s.items.length
    const total = scored.reduce((a, r) => a + Number(r.score), 0)
    const denominator = planned - failed
    return {
      key: s.key,
      label: s.label,
      weight: s.weight,
      planned,
      answered: rs.filter((r) => !r.raw_response?.skipped).length,
      score: denominator > 0 ? Math.round((total / denominator) * 100) : null,
    }
  })

  const usable = sections.filter((s) => s.score != null)
  const weightSum = usable.reduce((a, s) => a + s.weight, 0)
  const overall = weightSum > 0 ? Math.round(usable.reduce((a, s) => a + s.score * s.weight, 0) / weightSum) : null

  const skills = new Map()
  for (const r of responses) {
    if (r.score == null) continue
    const add = (code, w) => {
      if (!code) return
      const cur = skills.get(code) || { sum: 0, w: 0, n: 0 }
      cur.sum += Number(r.score) * w
      cur.w += w
      cur.n += 1
      skills.set(code, cur)
    }
    add(r.primary_skill_code, 1)
    for (const c of r.secondary_skill_codes || []) add(c, 0.5)
  }
  const skillMap = [...skills.entries()]
    .map(([code, v]) => ({ skill: code, score: Number((v.sum / v.w).toFixed(2)), items: v.n, level: SKILL_LEVEL(v.sum / v.w) }))
    .sort((a, b) => b.score - a.score)

  const band = bandFor(overall)
  return { sections, overall, band, skillMap, flags }
}
