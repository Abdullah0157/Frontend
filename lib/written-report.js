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

// ── Integrity notes ───────────────────────────────────────────────────────
// Signals only, for a person to review: leaving full screen, the tab or the
// window, attempts to paste text in or copy questions out (blocked in the
// browser), and correct answers given faster than reading allows. None of them
// proves cheating (a candidate may look away to think, or press Ctrl+V out of
// habit), so the report never fails anyone on them.

export const INTEGRITY_THRESHOLDS = Object.freeze({
  awaySeconds: 60,       // total time away from the test
  awayCount: 5,          // separate times away
  bigPasteChars: 200,    // one paste into a code or written answer
  copies: 3,             // copying text out of the test
  blockedCopies: 3,      // tries to copy the questions (blocked); one or two can be a habit
  fullscreenExits: 2,    // leaving full screen; one Esc press can be an accident
  fullscreenSeconds: 20, // total time out of full screen while a question was showing
  cameraSeconds: 20,     // total time the camera was off while a question was showing
  untypedMinChars: 150,  // a written or code answer that grew at least this much...
  untypedShare: 0.5,     // ...while less than half of that growth was seen being typed
  fastCorrect: 5,        // keyed answers correct in under a fifth of the expected time
})

export function summariseIntegrity(events, responses) {
  const t = INTEGRITY_THRESHOLDS
  const away = events.filter((e) => (e.kind === 'tab_hidden' || e.kind === 'window_blur') && e.ms >= 2000)
  const awaySeconds = Math.round(away.reduce((a, e) => a + e.ms, 0) / 1000)
  const pastes = events.filter((e) => e.kind === 'paste')
  const bigPastes = pastes.filter((e) => e.chars >= t.bigPasteChars)
  const copies = events.filter((e) => e.kind === 'copy')
  const pasteBlocked = events.filter((e) => e.kind === 'paste_blocked' || e.kind === 'drop_blocked')
  const copyBlocked = events.filter((e) => e.kind === 'copy_blocked')
  const fsExits = events.filter((e) => e.kind === 'fullscreen_exit').length
  const fsSeconds = Math.round(events.filter((e) => e.kind === 'fullscreen_back').reduce((a, e) => a + e.ms, 0) / 1000)
  const fsUnavailable = events.some((e) => e.kind === 'fullscreen_unavailable')
  const camOffs = events.filter((e) => e.kind === 'camera_off').length
  const camSeconds = Math.round(events.filter((e) => e.kind === 'camera_back').reduce((a, e) => a + e.ms, 0) / 1000)
  const fastCorrect = responses.filter((r) =>
    ['mcq', 'multi_select', 'sjt'].includes(r.type) && Number(r.score) === 1 &&
    Number.isFinite(r.time_spent_ms) && r.expected_time_s &&
    r.time_spent_ms < Math.max(4000, 0.2 * r.expected_time_s * 1000)
  ).length

  // Typing test: pasting is blocked in the browser but attempts are counted;
  // a very regular, very fast key rhythm suggests an auto-typing tool.
  const typingResp = responses.filter((r) => r.type === 'typing' && r.raw_response)
  const typingPastes = typingResp.reduce((a, r) => a + (Number(r.raw_response.pasteAttempts) || 0), 0)
  const autoTyping = typingResp.some((r) => (Number(r.raw_response.stats?.fastShare) || 0) > 0.3 && (Number(r.raw_response.stats?.keystrokes) || 0) > 50)

  // Written and code answers whose text appeared without matching typing: a
  // tool or extension put it there (pasting is blocked in the browser).
  const untyped = responses.filter((r) => {
    const ty = r.raw_response?.typed
    return ty && typeof ty === 'object' && ty.growth >= t.untypedMinChars && ty.chars < t.untypedShare * ty.growth
  })

  const notes = []
  if (untyped.length) {
    const worst = untyped.reduce((a, r) => (r.raw_response.typed.growth > a.raw_response.typed.growth ? r : a))
    notes.push(`${untyped.length} answer(s) appeared without matching typing (for example ${worst.raw_response.typed.growth} characters appeared but ${worst.raw_response.typed.chars} were typed).`)
  }
  if (typingPastes > 0) notes.push(`Tried to paste into the typing test ${typingPastes} time(s) (blocked).`)
  if (autoTyping) notes.push('The typing rhythm looked automated (many keys less than 15 ms apart).')
  if (camOffs > 0 && (camOffs >= 2 || camSeconds >= t.cameraSeconds)) {
    notes.push(`The camera was off ${camOffs} time(s), ${camSeconds} seconds in total.`)
  }
  if (fsExits >= t.fullscreenExits || fsSeconds >= t.fullscreenSeconds) {
    notes.push(`Left full screen ${fsExits} time(s), ${fsSeconds} seconds in total.`)
  }
  if (awaySeconds > t.awaySeconds || away.length >= t.awayCount) {
    notes.push(`Left the test ${away.length} time(s), ${awaySeconds} seconds in total.`)
  }
  if (bigPastes.length) {
    notes.push(`Pasted ${bigPastes.length} large block(s) of text into answers (largest ${Math.max(...bigPastes.map((p) => p.chars))} characters).`)
  }
  if (copies.length >= t.copies) notes.push(`Copied text from the test ${copies.length} times.`)
  if (pasteBlocked.length) {
    const largest = Math.max(...pasteBlocked.map((e) => e.chars))
    notes.push(`Tried to paste or drop text from outside the test ${pasteBlocked.length} time(s) (blocked; largest ${largest} characters).`)
  }
  if (copyBlocked.length >= t.blockedCopies) notes.push(`Tried to copy the questions ${copyBlocked.length} times (blocked).`)
  if (fastCorrect >= t.fastCorrect) notes.push(`${fastCorrect} answers were correct in under a fifth of the usual reading time.`)

  return {
    level: notes.length ? 'review' : 'clear',
    notes,
    counts: {
      away: away.length, away_seconds: awaySeconds, pastes: pastes.length,
      largest_paste: pastes.length ? Math.max(...pastes.map((p) => p.chars)) : 0,
      copies: copies.length, fast_correct: fastCorrect, typing_paste_attempts: typingPastes,
      paste_blocked: pasteBlocked.length, copy_blocked: copyBlocked.length, untyped_answers: untyped.length,
      fullscreen_exits: fsExits, fullscreen_seconds: fsSeconds, fullscreen_unavailable: fsUnavailable,
      camera_offs: camOffs, camera_seconds: camSeconds,
    },
    disclaimer: 'Signals for review, not proof of cheating. Ask about them in the interview before deciding anything.',
  }
}

// ── Resume versus results ─────────────────────────────────────────────────

const squash = (s) => String(s || '').toLowerCase().replace(/\s+/g, ' ').trim()

// Keep only claims whose quote really appears in the resume and whose skills
// are ones the test measured; then judge each from the test scores alone.
export function checkResumeClaims(claims, resumeText, skillMap) {
  const resume = squash(resumeText)
  const tested = new Map(skillMap.map((s) => [s.skill, s]))
  const out = []
  for (const c of claims || []) {
    const quote = String(c.quote || '').trim()
    if (quote.length < 6 || !resume.includes(squash(quote))) continue
    const skills = [...new Set((c.skills || []).filter((code) => tested.has(code)))]
    if (skills.length === 0) {
      out.push({ claim: String(c.claim || quote), quote, skills: [], verdict: 'not_tested' })
      continue
    }
    const score = skills.reduce((a, code) => a + tested.get(code).score, 0) / skills.length
    out.push({
      claim: String(c.claim || quote),
      quote,
      skills,
      score: Number(score.toFixed(2)),
      verdict: score >= 0.75 ? 'confirmed' : score >= 0.5 ? 'partly' : 'not_confirmed',
    })
    if (out.length >= 8) break
  }
  const count = (v) => out.filter((x) => x.verdict === v).length
  return {
    claims: out,
    summary: { confirmed: count('confirmed'), partly: count('partly'), not_confirmed: count('not_confirmed'), not_tested: count('not_tested') },
  }
}

// ── Follow-up questions for the voice interview ───────────────────────────
// Built from the results, not invented: the weakest skills, the coding task,
// claims the test did not back up, and any integrity notes.

export function buildFollowups({ skillMap, skillLabels = {}, coding, resumeCheck, integrity }) {
  const qs = []
  const label = (code) => skillLabels[code] || code.split('.').pop().replace(/_/g, ' ')
  if (coding) {
    qs.push({
      question: 'Walk me through how your solution to the coding task works, and which edge cases you thought about.',
      why: coding.total ? `Their code passed ${coding.passed} of ${coding.total} tests. Hearing them explain it checks that the work is their own.` : 'Checks that the code is their own work.',
      skill: 'engineering.craft.correctness',
    })
  }
  for (const claim of (resumeCheck?.claims || []).filter((c) => c.verdict === 'not_confirmed').slice(0, 2)) {
    qs.push({
      question: `Your CV says "${claim.quote}". Tell me about one specific project where you did that, and what you would do differently now.`,
      why: `The test did not back this claim up (score ${Math.round(claim.score * 100)}%).`,
      skill: claim.skills[0],
    })
  }
  // Prefer weak skills measured by 2+ questions: one wrong answer is thin evidence.
  const weak = [...skillMap].filter((k) => k.level === 'weak')
    .sort((a, b) => (b.items >= 2) - (a.items >= 2) || a.score - b.score)
  for (const s of weak.slice(0, 2)) {
    qs.push({
      question: `Tell me about a time you had to deal with ${label(s.skill)} at work. What went wrong, and what did you change?`,
      why: `Weak area in the written test (${Math.round(s.score * 100)}% over ${s.items} ${s.items === 1 ? 'question' : 'questions'}).`,
      skill: s.skill,
    })
  }
  if (integrity?.level === 'review') {
    qs.push({
      question: 'How did you approach the written test, and did you use any notes or tools while taking it?',
      why: `Integrity notes to clear up: ${integrity.notes.join(' ')}`,
      skill: 'behavioral.ownership.accountability',
    })
  }
  return qs.slice(0, 5)
}
