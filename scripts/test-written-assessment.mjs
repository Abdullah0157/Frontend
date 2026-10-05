// Unit tests for the written assessment's pure logic.
//   node --test scripts/test-written-assessment.mjs
// (Python runner tests need CODE_RUNNER_URL; they are skipped without it.)

import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  getBlueprint, drawForm, formIsUsable, bandFor, LEVELS, TRACKS, seededRandom,
} from '../lib/assessment-blueprint.js'
import { scoreKeyedItem, reviewScoreFrom } from '../lib/written-scoring.js'
import { summariseResponses } from '../lib/written-report.js'
import { resultsMatch, runTests } from '../lib/code-runner.js'

// ── Blueprint ─────────────────────────────────────────────────────────────

test('every level: weights add up to 100 and minutes match the design', () => {
  const minutes = { L2: 59, L3: 55, L4: 55, L5: 46 }
  for (const level of ['L2', 'L3', 'L4', 'L5']) {
    const bp = getBlueprint({ track: 'backend', level })
    const sum = bp.sections.reduce((a, s) => a + s.weight, 0)
    assert.ok(Math.abs(sum - 100) < 0.05, `${level} weights sum to ${sum}`)
    assert.equal(bp.totalMinutes, minutes[level], `${level} minutes`)
  }
})

test('switching off the Junior reasoning section rescales the other weights to 100', () => {
  const bp = getBlueprint({ track: 'backend', level: 'L2', disabledSections: ['reasoning'] })
  assert.ok(!bp.sections.some((s) => s.key === 'reasoning'))
  assert.ok(Math.abs(bp.sections.reduce((a, s) => a + s.weight, 0) - 100) < 0.05)
})

test('only Mid has no reasoning section; unknown track or level is rejected', () => {
  assert.ok(!getBlueprint({ track: 'backend', level: 'L3' }).sections.some((s) => s.key === 'reasoning'))
  assert.throws(() => getBlueprint({ track: 'nope', level: 'L3' }))
  assert.throws(() => getBlueprint({ track: 'backend', level: 'L9' }))
  assert.equal(Object.values(TRACKS).filter((t) => t.family === 'swe').length, 6)
})

// A synthetic bank big enough for a Mid backend form.
function fakeBank() {
  const bank = []
  let n = 0
  const add = (extra, count) => {
    for (let i = 0; i < count; i++) {
      bank.push({
        id: `item-${++n}`, tracks: ['backend', 'fullstack'], levels: ['L3'], language: null,
        format: null, primary_skill_code: `skill.${n % 7}`, content: {}, ...extra,
      })
    }
  }
  add({ type: 'mcq', format: 'concept', content: { choices: ['a', 'b', 'c', 'd'] } }, 40)
  add({ type: 'multi_select', format: 'concept', content: { choices: ['a', 'b', 'c', 'd', 'e'] } }, 8)
  add({ type: 'mcq', format: 'code_output', language: 'javascript', content: { choices: ['1', '2', '3', '4'] } }, 6)
  add({ type: 'mcq', format: 'code_output', language: 'python', content: { choices: ['1', '2', '3', '4'] } }, 6)
  add({ type: 'coding', content: { function_name: { javascript: 'f', python: 'f' } } }, 4)
  add({ type: 'code_review', content: { code_by_language: { javascript: 'x', python: 'x' } } }, 3)
  add({ type: 'sjt', content: { choices: ['a', 'b', 'c', 'd'] } }, 12)
  add({ type: 'mcq', format: 'concept', levels: ['L5'] }, 5) // wrong level: must never be drawn
  return bank
}

test('a Mid form has the planned counts, no repeats, and only the candidate language', () => {
  const bp = getBlueprint({ track: 'backend', level: 'L3' })
  const bank = fakeBank()
  const form = drawForm(bp, bank, { language: 'python', seed: 42 })
  assert.ok(formIsUsable(form))
  assert.deepEqual(form.shortfall, [])
  const counts = Object.fromEntries(form.sections.map((s) => [s.key, s.items.length]))
  assert.deepEqual(counts, { knowledge: 20, coding: 1, review: 1, judgement: 6 })
  const ids = form.sections.flatMap((s) => s.items.map((i) => i.itemId))
  assert.equal(new Set(ids).size, ids.length, 'no item drawn twice')
  const byId = new Map(bank.map((b) => [b.id, b]))
  for (const id of ids) {
    const it = byId.get(id)
    assert.ok(it.levels.includes('L3'))
    assert.notEqual(it.language, 'javascript', 'a Python candidate never sees JavaScript-only items')
  }
  const codeOutput = ids.filter((id) => byId.get(id).format === 'code_output').length
  assert.equal(codeOutput, 3, 'Mid knowledge has 3 code-output items in the candidate language')
})

test('TypeScript candidates get the JavaScript items; draws are reproducible from the seed', () => {
  const bp = getBlueprint({ track: 'backend', level: 'L3' })
  const bank = fakeBank()
  const a = drawForm(bp, bank, { language: 'typescript', seed: 7 })
  const b = drawForm(bp, bank, { language: 'typescript', seed: 7 })
  const c = drawForm(bp, bank, { language: 'typescript', seed: 8 })
  assert.deepEqual(a, b)
  assert.notDeepEqual(a.sections, c.sections)
  const byId = new Map(bank.map((x) => [x.id, x]))
  const langs = a.sections.flatMap((s) => s.items).map((i) => byId.get(i.itemId).language).filter(Boolean)
  assert.ok(langs.length > 0 && langs.every((l) => l === 'javascript'))
})

test('knowledge items are spread across skills, not clustered', () => {
  const bp = getBlueprint({ track: 'backend', level: 'L3' })
  const bank = fakeBank()
  const byId = new Map(bank.map((x) => [x.id, x]))
  const form = drawForm(bp, bank, { language: 'javascript', seed: 3 })
  const skills = form.sections[0].items.map((i) => byId.get(i.itemId).primary_skill_code)
  const max = Math.max(...Object.values(skills.reduce((m, k) => ({ ...m, [k]: (m[k] || 0) + 1 }), {})))
  assert.ok(max <= 4, `one skill took ${max} of 20 slots`)
})

test('a bank too small for a section is reported, and the form is unusable without any items', () => {
  const bp = getBlueprint({ track: 'backend', level: 'L3' })
  const form = drawForm(bp, fakeBank().filter((i) => i.type !== 'code_review'), { language: 'javascript', seed: 1 })
  assert.ok(form.shortfall.some((s) => s.section === 'review'))
  assert.equal(formIsUsable(form), false)
})

test('seeded random is deterministic and in [0,1)', () => {
  const r1 = seededRandom(5); const r2 = seededRandom(5)
  for (let i = 0; i < 100; i++) {
    const x = r1()
    assert.equal(x, r2())
    assert.ok(x >= 0 && x < 1)
  }
})

// ── Keyed scoring through the per-candidate shuffle ───────────────────────

const mcq = { type: 'mcq', content: { choices: ['A', 'B', 'C', 'D'] }, scoring_rubric: { answer: { correct: 2 } } }

test('mcq: the shown option is mapped back through the shuffle', () => {
  const order = [3, 2, 0, 1] // option C (original 2) is shown second
  assert.equal(scoreKeyedItem(mcq, { choice: 1 }, order).score, 1)
  assert.equal(scoreKeyedItem(mcq, { choice: 0 }, order).score, 0)
  assert.equal(scoreKeyedItem(mcq, { choice: null }, order).score, 0)
  assert.equal(scoreKeyedItem(mcq, { choice: 9 }, order).score, 0)
})

test('multi_select: partial credit, wrong picks cost, never below zero', () => {
  const item = { type: 'multi_select', content: { choices: ['a', 'b', 'c', 'd', 'e'] }, scoring_rubric: { answer: { correct: [0, 3] } } }
  const order = [0, 1, 2, 3, 4]
  assert.equal(scoreKeyedItem(item, { choices: [0, 3] }, order).score, 1)
  assert.equal(scoreKeyedItem(item, { choices: [0] }, order).score, 0.5)
  assert.equal(scoreKeyedItem(item, { choices: [0, 1] }, order).score, 0)
  assert.equal(scoreKeyedItem(item, { choices: [1, 2, 4] }, order).score, 0)
  assert.equal(scoreKeyedItem(item, { choices: [0, 0, 3] }, order).score, 1, 'duplicate picks count once')
  assert.equal(scoreKeyedItem(item, { choices: [0, 1, 2, 3, 4] }, order).score, 0, 'ticking everything does not pay')
})

test('sjt: points scaled to 0..1 through the shuffle', () => {
  const item = { type: 'sjt', content: { choices: ['a', 'b', 'c', 'd'] }, scoring_rubric: { answer: { points: [1, 3, 0, 2] } } }
  const order = [1, 3, 0, 2]
  assert.equal(scoreKeyedItem(item, { choice: 0 }, order).score, 1)
  assert.equal(scoreKeyedItem(item, { choice: 1 }, order).score, 2 / 3)
  assert.equal(scoreKeyedItem(item, { choice: 3 }, order).score, 0)
})

// ── Code review maths ─────────────────────────────────────────────────────

test('code review: found issues weighted by severity, fix quality and false alarms', () => {
  const issues = [
    { id: 'inj', severity: 'critical', points: 3 },
    { id: 'await', severity: 'major', points: 2 },
    { id: 'n1', severity: 'minor', points: 1 },
  ]
  const perfect = reviewScoreFrom(issues, { issues: issues.map((i) => ({ id: i.id, found: 1, fix: 1 })), prioritised: 1, false_alarms: 0 })
  assert.equal(perfect.score, 1)
  const none = reviewScoreFrom(issues, { issues: [], prioritised: 0, false_alarms: 0 })
  assert.equal(none.score, 0)
  const critOnly = reviewScoreFrom(issues, { issues: [{ id: 'inj', found: 1, fix: 1 }], prioritised: 1, false_alarms: 0 })
  assert.ok(critOnly.score > 0.55 && critOnly.score < 0.6, `critical only = ${critOnly.score}`)
  const noisy = reviewScoreFrom(issues, { issues: [{ id: 'inj', found: 1, fix: 1 }], prioritised: 1, false_alarms: 20 })
  assert.equal(noisy.score, 0, 'false alarms can pull to zero, never below')
  const junk = reviewScoreFrom(issues, { issues: [{ id: 'inj', found: 7, fix: 9 }], prioritised: 'x', false_alarms: -3 })
  assert.equal(junk.score, 0, 'out-of-range marker output is ignored, not trusted')
})

// ── Report maths ──────────────────────────────────────────────────────────

test('report: unanswered items count as zero, weights apply, band and skill map', () => {
  const form = {
    sections: [
      { key: 'knowledge', label: 'K', weight: 25, items: [{}, {}, {}, {}] },
      { key: 'coding', label: 'C', weight: 40, items: [{}] },
      { key: 'review', label: 'R', weight: 15, items: [{}] },
      { key: 'judgement', label: 'J', weight: 20, items: [{}, {}] },
    ],
  }
  const r = (section, score, skill, extra = {}) => ({ section, score, primary_skill_code: skill, secondary_skill_codes: [], raw_response: {}, ai_evaluation: {}, ...extra })
  const responses = [
    r('knowledge', 1, 'a'), r('knowledge', 1, 'a'), r('knowledge', 0, 'b'),
    // 4th knowledge item never reached
    r('coding', 0.8, 'c'),
    r('review', 0.5, 'd'),
    r('judgement', 1, 'e'), r('judgement', 0, 'e', { raw_response: { skipped: true } }),
  ]
  const out = summariseResponses(form, responses)
  const k = out.sections.find((s) => s.key === 'knowledge')
  assert.equal(k.score, 50, 'two of four right, the unreached one is zero')
  assert.equal(out.sections.find((s) => s.key === 'judgement').answered, 1)
  assert.equal(out.overall, Math.round(50 * 0.25 + 80 * 0.4 + 50 * 0.15 + 50 * 0.2))
  assert.equal(out.band.key, 'borderline')
  assert.equal(out.skillMap.find((s) => s.skill === 'a').level, 'strong')
  assert.equal(out.skillMap.find((s) => s.skill === 'b').level, 'weak')
})

test('report: an item the AI could not mark is flagged and left out, not counted as zero', () => {
  const form = { sections: [{ key: 'coding', label: 'C', weight: 100, items: [{}, {}] }] }
  const out = summariseResponses(form, [
    { section: 'coding', score: 1, primary_skill_code: 'x', raw_response: {}, ai_evaluation: {} },
    { section: 'coding', score: null, primary_skill_code: 'x', raw_response: {}, ai_evaluation: {} },
  ])
  assert.equal(out.overall, 100)
  assert.ok(out.flags.some((f) => f.kind === 'not_scored'))
})

test('bands follow the design cut points', () => {
  assert.equal(bandFor(80).key, 'strong')
  assert.equal(bandFor(79).key, 'good')
  assert.equal(bandFor(65).key, 'good')
  assert.equal(bandFor(64).key, 'borderline')
  assert.equal(bandFor(50).key, 'borderline')
  assert.equal(bandFor(49).key, 'not_yet')
  assert.equal(bandFor(null), null)
})

// ── Code runner ───────────────────────────────────────────────────────────

test('result comparison modes', () => {
  assert.ok(resultsMatch({ a: 1, b: [1, 2] }, { b: [1, 2], a: 1 }), 'object key order ignored')
  assert.ok(!resultsMatch([1, 2], [2, 1]))
  assert.ok(resultsMatch([1, 2], [2, 1], 'unordered'))
  assert.ok(resultsMatch([{ x: 1 }, { y: 2 }], [{ y: 2 }, { x: 1 }], 'unordered'))
  assert.ok(resultsMatch(0.1 + 0.2, 0.3, 'float'))
  assert.ok(!resultsMatch(0.1 + 0.2, 0.3))
  assert.ok(!resultsMatch(null, undefined))
})

const fn = { javascript: 'add', python: 'add' }
const tests = [{ name: 't', calls: [{ args: [2, 3], expected: 5 }] }]

test('JavaScript sandbox: correct, wrong, no host access, loops stopped', async () => {
  assert.equal((await runTests({ language: 'javascript', code: 'function add(a,b){return a+b}', functionName: fn, tests })).passed, 1)
  assert.equal((await runTests({ language: 'javascript', code: 'function add(a,b){return a-b}', functionName: fn, tests })).passed, 0)
  const host = await runTests({ language: 'javascript', code: 'function add(){ return typeof process + typeof require }', functionName: fn,
    tests: [{ name: 'h', calls: [{ args: [], expected: 'undefinedundefined' }] }] })
  assert.equal(host.passed, 1)
  const loop = await runTests({ language: 'javascript', code: 'function add(){ for(;;){} }', functionName: fn, tests, timeoutMs: 500 })
  assert.equal(loop.results[0].error, 'Time limit exceeded')
})

test('TypeScript is accepted, including export and type annotations', async () => {
  const r = await runTests({ language: 'typescript', code: 'export function add(a: number, b: number): number { return a + b }', functionName: fn, tests })
  assert.equal(r.passed, 1)
})

test('Python sandbox (needs CODE_RUNNER_URL)', { skip: !process.env.CODE_RUNNER_URL }, async () => {
  assert.equal((await runTests({ language: 'python', code: 'def add(a, b):\n    return a + b\n', functionName: fn, tests })).passed, 1)
  const loop = await runTests({ language: 'python', code: 'def add(a, b):\n    while True: pass\n', functionName: fn, tests, timeoutMs: 1000 })
  assert.equal(loop.results[0].error, 'Time limit exceeded')
})

test('near-duplicate items (same group) never appear in the same form', () => {
  const bp = getBlueprint({ track: 'backend', level: 'L3' })
  const bank = fakeBank()
  // Put every knowledge mcq into 5 groups: at most 5 of them can be drawn.
  let k = 0
  for (const it of bank) if (it.type === 'mcq' && it.format === 'concept' && it.levels.includes('L3')) it.tags = [`group:g${k++ % 5}`]
  for (let seed = 1; seed <= 20; seed++) {
    const form = drawForm(bp, bank, { language: 'javascript', seed })
    const byId = new Map(bank.map((x) => [x.id, x]))
    const groups = form.sections.flatMap((s) => s.items).map((i) => (byId.get(i.itemId).tags || [])[0]).filter(Boolean)
    assert.equal(new Set(groups).size, groups.length, `seed ${seed}: a group appeared twice`)
  }
})

// ── Job link ──────────────────────────────────────────────────────────────
import { suggestAssessment, normaliseAssessmentConfig } from '../lib/assessment-blueprint.js'
import { summariseIntegrity, checkResumeClaims, buildFollowups } from '../lib/written-report.js'

test('suggestion: track, level and languages come from the title and description', () => {
  const a = suggestAssessment({ title: 'Senior Backend Engineer', description: 'Python, Django and PostgreSQL. 6+ years.' })
  assert.deepEqual([a.track, a.level, a.languages], ['backend', 'L4', ['python']])
  assert.ok(a.reasons.length >= 2)
  assert.equal(suggestAssessment({ title: 'Junior Node.js developer' }).level, 'L2')
  assert.equal(suggestAssessment({ title: 'Tech Lead' }).level, 'L5')
  assert.equal(suggestAssessment({ title: 'Software Engineer', description: 'We want 3 years of API work in TypeScript' }).level, 'L3')
  const ts = suggestAssessment({ title: 'API Engineer', description: 'TypeScript services' })
  assert.deepEqual(ts.languages.sort(), ['javascript', 'typescript'])
  const fe = suggestAssessment({ title: 'React Frontend Developer' })
  assert.deepEqual([fe.track, fe.languages], ['frontend', ['javascript']])
  const fePy = suggestAssessment({ title: 'Frontend Engineer', description: 'Our backend is Python' })
  assert.deepEqual(fePy.languages.sort(), ['javascript', 'typescript'], 'frontend is never coded in Python')
  assert.equal(suggestAssessment({ title: 'Full Stack Developer (Django + React)' }).track, 'fullstack')
  const mob = suggestAssessment({ title: 'iOS Developer' })
  assert.equal(mob.track, 'backend', 'unbuilt tracks fall back to Backend')
  assert.ok(mob.reasons.some((r) => /not ready yet/.test(r)))
  assert.deepEqual(suggestAssessment({ title: 'Software Engineer' }).languages.sort(), ['javascript', 'python', 'typescript'])
  assert.equal(suggestAssessment({ title: 'Engineer' }).track, 'general', 'a bare "Engineer" is not assumed to be software')
})

test('job test settings are validated before saving', () => {
  assert.equal(normaliseAssessmentConfig({ enabled: false }), null)
  assert.equal(normaliseAssessmentConfig(null), null)
  assert.throws(() => normaliseAssessmentConfig({ track: 'frontend', level: 'L3', languages: ['python'] }))
  assert.throws(() => normaliseAssessmentConfig({ track: 'backend', level: 'L9', languages: ['python'] }))
  assert.throws(() => normaliseAssessmentConfig({ track: 'backend', level: 'L3', languages: ['cobol'] }))
  const ok = normaliseAssessmentConfig({ track: 'backend', level: 'L2', languages: ['python', 'python', 'rust'], disabledSections: ['reasoning', 'coding'] })
  assert.deepEqual([ok.languages, ok.disabledSections], [['python'], ['reasoning']])
})

// ── Integrity ─────────────────────────────────────────────────────────────

test('integrity: quiet tests are clear; each signal type raises a note', () => {
  assert.equal(summariseIntegrity([], []).level, 'clear')
  assert.equal(summariseIntegrity([{ kind: 'window_blur', ms: 1500 }, { kind: 'paste', chars: 40 }], []).level, 'clear', 'short blur and small paste are normal')
  const away = summariseIntegrity([{ kind: 'tab_hidden', ms: 50000 }, { kind: 'window_blur', ms: 20000 }], [])
  assert.equal(away.level, 'review')
  assert.match(away.notes[0], /70 seconds/)
  assert.equal(summariseIntegrity([{ kind: 'paste', chars: 900 }], []).level, 'review')
  assert.equal(summariseIntegrity([1, 2, 3].map(() => ({ kind: 'copy', chars: 30 })), []).level, 'review')
  const fast = Array.from({ length: 5 }, () => ({ type: 'mcq', score: 1, time_spent_ms: 3000, expected_time_s: 60 }))
  assert.equal(summariseIntegrity([], fast).counts.fast_correct, 5)
  assert.equal(summariseIntegrity([], fast).level, 'review')
  const slow = fast.map((r) => ({ ...r, time_spent_ms: 30000 }))
  assert.equal(summariseIntegrity([], slow).level, 'clear')
  assert.match(summariseIntegrity([], []).disclaimer, /not proof/)
})

// ── Resume versus results ─────────────────────────────────────────────────

test('resume check: invented quotes are dropped; verdicts come from scores only', () => {
  const resume = 'Built REST APIs   serving 2M requests a day.\nExpert in PostgreSQL indexing and query tuning.\nLed a team of 4.'
  const skills = [
    { skill: 'engineering.backend.api_design', score: 0.9 },
    { skill: 'engineering.data.indexing', score: 0.3 },
  ]
  const out = checkResumeClaims([
    { claim: 'APIs at scale', quote: 'Built REST APIs serving 2M requests a day', skills: ['engineering.backend.api_design'] },
    { claim: 'DB tuning', quote: 'expert in postgresql indexing', skills: ['engineering.data.indexing', 'made.up.code'] },
    { claim: 'Leadership', quote: 'Led a team of 4.', skills: [] },
    { claim: 'Invented', quote: 'Ten years of Kubernetes at Google', skills: ['engineering.backend.api_design'] },
  ], resume, skills)
  assert.deepEqual(out.claims.map((c) => c.verdict), ['confirmed', 'not_confirmed', 'not_tested'])
  assert.deepEqual(out.claims[1].skills, ['engineering.data.indexing'], 'unknown skill codes are dropped')
  assert.deepEqual(out.summary, { confirmed: 1, partly: 0, not_confirmed: 1, not_tested: 1 })
})

test('follow-up questions come from the results, at most five', () => {
  const qs = buildFollowups({
    skillMap: [
      { skill: 'engineering.data.indexing', score: 0.2, items: 3, level: 'weak' },
      { skill: 'engineering.security.auth', score: 0.4, items: 2, level: 'weak' },
      { skill: 'engineering.security.injection', score: 0.45, items: 2, level: 'weak' },
      { skill: 'engineering.backend.api_design', score: 0.9, items: 4, level: 'strong' },
    ],
    skillLabels: { 'engineering.data.indexing': 'Indexes and query performance' },
    coding: { passed: 11, total: 14 },
    resumeCheck: { claims: [{ quote: 'Expert in PostgreSQL', verdict: 'not_confirmed', score: 0.2, skills: ['engineering.data.indexing'] }] },
    integrity: { level: 'review', notes: ['Left the test 6 time(s), 90 seconds in total.'] },
  })
  assert.equal(qs.length, 5)
  assert.match(qs[0].question, /coding task/)
  assert.ok(qs.some((q) => q.question.includes('Expert in PostgreSQL')))
  assert.ok(qs.some((q) => /Indexes and query performance/.test(q.question)), 'weakest skill uses its label')
  assert.ok(qs.every((q) => q.why && q.skill))
  assert.equal(buildFollowups({ skillMap: [], coding: null, resumeCheck: null, integrity: { level: 'clear', notes: [] } }).length, 0)
})

test('frontend allows only JavaScript/TypeScript; items in other languages are never drawn', () => {
  assert.throws(() => normaliseAssessmentConfig({ track: 'frontend', level: 'L3', languages: ['python'] }), /JavaScript|javascript/)
  assert.deepEqual(normaliseAssessmentConfig({ track: 'frontend', level: 'L3', languages: ['python', 'typescript'] }).languages, ['typescript'])
  const bank = fakeBank().map((it) => ({ ...it, tracks: ['frontend'] }))
  // One coding task exists only in Python: a JavaScript candidate must not get it.
  bank.filter((i) => i.type === 'coding').forEach((i, k) => { i.content = { function_name: k === 0 ? { python: 'f' } : { javascript: 'f' } } })
  const pyOnly = bank.find((i) => i.type === 'coding' && !i.content.function_name.javascript).id
  for (let seed = 1; seed <= 15; seed++) {
    const form = drawForm(getBlueprint({ track: 'frontend', level: 'L3' }), bank, { language: 'javascript', seed })
    assert.ok(!form.sections.flatMap((s) => s.items).some((i) => i.itemId === pyOnly))
  }
})

test('full stack takes half its concept questions from each side', () => {
  const bank = []
  let n = 0
  const add = (tracks, count, extra = {}) => { for (let i = 0; i < count; i++) bank.push({ id: `fs-${++n}`, type: 'mcq', format: 'concept', tracks, levels: ['L3'], language: null, primary_skill_code: `s.${n % 9}`, content: { choices: ['a', 'b', 'c', 'd'] }, ...extra }) }
  add(['backend', 'fullstack'], 30)
  add(['frontend', 'fullstack'], 30)
  add(['fullstack'], 4)
  add(['backend', 'fullstack'], 6, { format: 'code_output', language: 'javascript' })
  add(['backend', 'fullstack'], 3, { type: 'coding', content: { function_name: { javascript: 'f' } } })
  add(['frontend', 'fullstack'], 3, { type: 'code_review', content: { code_by_language: { javascript: 'x' } } })
  add(['backend', 'fullstack'], 8, { type: 'sjt', content: { choices: ['a', 'b', 'c', 'd'] } })
  const bp = getBlueprint({ track: 'fullstack', level: 'L3' })
  const byId = new Map(bank.map((b) => [b.id, b]))
  const form = drawForm(bp, bank, { language: 'javascript', seed: 11 })
  assert.ok(formIsUsable(form))
  for (let seed = 1; seed <= 20; seed++) {
    const f = drawForm(bp, bank, { language: 'javascript', seed })
    const concept = f.sections[0].items.map((i) => byId.get(i.itemId)).filter((it) => it.format === 'concept')
    const fe = concept.filter((it) => it.tracks.includes('frontend')).length
    const be = concept.filter((it) => it.tracks.includes('backend')).length
    const only = concept.filter((it) => it.tracks.length === 1).length
    assert.deepEqual([concept.length, only, be, fe], [17, 3, 7, 7], `seed ${seed}: backend ${be}, frontend ${fe}, full-stack-only ${only}`)
  }
})

import { toItemRow } from '../lib/assessment-bank.js'

test('seeder change detection covers tags, not just the text', () => {
  const base = { bank_key: 'x.y.z', type: 'mcq', section: 'knowledge', format: 'concept', tracks: ['backend'], levels: ['L3'], language: null,
    difficulty: 'easy', primary_skill_code: 'engineering.backend.http', prompt: 'p'.repeat(30), choices: ['a', 'b', 'c', 'd'], answer: { correct: 0 }, explanation: 'e'.repeat(40), expected_time_s: 60 }
  const h = (it) => toItemRow(it).content_hash
  assert.notEqual(h(base), h({ ...base, tracks: ['backend', 'frontend'] }), 'retagging a track is a change')
  assert.notEqual(h(base), h({ ...base, levels: ['L2', 'L3'] }))
  assert.notEqual(h(base), h({ ...base, group: 'g' }))
  assert.equal(h(base), h({ ...base }), 'same item, same hash')
})

// ── Families beyond software ──────────────────────────────────────────────
import { FAMILIES, roleFamilyFor, trackFromRoleFamily } from '../lib/assessment-blueprint.js'
import { typingMetrics, typingScore, trustedElapsedMs } from '../lib/typing.js'
import { writingScoreFrom } from '../lib/written-scoring.js'

test('22 families are listed; General, Software and Customer service are ready', () => {
  assert.equal(Object.keys(FAMILIES).length, 23, '22 job families plus General')
  assert.deepEqual(Object.entries(FAMILIES).filter(([, f]) => f.ready).map(([k]) => k).sort(), ['customer_service', 'general', 'swe'])
})

test('General and Customer service blueprints: weights 100, design minutes, no code', () => {
  for (const [track, level, minutes] of [['general', 'staff', 32], ['general', 'manager', 32], ['customer_service', 'agent', 22]]) {
    const bp = getBlueprint({ track, level })
    assert.ok(Math.abs(bp.sections.reduce((a, x) => a + x.weight, 0) - 100) < 0.05, `${track}/${level} weights`)
    assert.equal(bp.totalMinutes, minutes, `${track}/${level} minutes`)
    assert.equal(bp.usesCode, false)
  }
  assert.throws(() => getBlueprint({ track: 'general', level: 'L3' }), /unknown level/)
  assert.equal(getBlueprint({ track: 'general', level: 'manager' }).sections[0].weight, 40, 'managers: judgement counts most')
})

test('Customer service: chat roles weight typing higher and carry the chat pass marks', () => {
  const voice = getBlueprint({ track: 'customer_service', level: 'agent' })
  const chat = getBlueprint({ track: 'customer_service', level: 'agent', options: { typingProfile: 'chat' } })
  const w = (bp, k) => bp.sections.find((x) => x.key === k).weight
  assert.deepEqual([w(voice, 'typing'), w(voice, 'accuracy')], [15, 30])
  assert.deepEqual([w(chat, 'typing'), w(chat, 'accuracy')], [25, 20])
  assert.deepEqual(voice.options.typing, { profile: 'voice', netWpm: 25, accuracy: 92 })
  assert.deepEqual(chat.options.typing, { profile: 'chat', netWpm: 35, accuracy: 95 })
  const custom = getBlueprint({ track: 'customer_service', level: 'agent', options: { typingProfile: 'chat', typingNetWpm: 40, typingAccuracy: 300 } })
  assert.deepEqual([custom.options.typing.netWpm, custom.options.typing.accuracy], [40, 95], 'an out-of-range override is ignored')
})

test('role family codes round-trip for every ready track', () => {
  for (const t of ['backend', 'frontend', 'fullstack', 'general', 'customer_service']) assert.equal(trackFromRoleFamily(roleFamilyFor(t)), t)
  assert.equal(roleFamilyFor('backend'), 'swe-backend')
  assert.equal(roleFamilyFor('general'), 'general')
  assert.equal(trackFromRoleFamily('nonsense'), null)
})

test('suggestion covers every industry: ready ones get their test, others get General with a note', () => {
  const s = (title, description = '') => suggestAssessment({ title, description })
  assert.deepEqual([s('Customer Support Agent', 'live chat and email').track, s('Customer Support Agent', 'live chat and email').options.typingProfile], ['customer_service', 'chat'])
  assert.equal(s('Call Centre Agent').options.typingProfile, 'voice')
  const nurse = s('Registered Nurse')
  assert.deepEqual([nurse.track, nurse.level, nurse.recognisedFamily], ['general', 'staff', 'healthcare'])
  assert.match(nurse.note, /Healthcare test is coming/)
  assert.equal(s('Store Manager').level, 'manager')
  assert.equal(s('Office Administrator').recognisedFamily, 'admin')
  assert.equal(s('Zookeeper').recognisedFamily, null)
  assert.match(s('Zookeeper').note, /No specific industry/)
  assert.equal(s('Senior Backend Engineer').track, 'backend')
})

test('settings: non-software tests have no languages; customer service keeps its typing options', () => {
  const g = normaliseAssessmentConfig({ track: 'general', level: 'manager', languages: ['python'] })
  assert.deepEqual([g.family, g.level, g.languages], ['general', 'manager', []])
  assert.throws(() => normaliseAssessmentConfig({ track: 'general', level: 'agent' }), /level/)
  const cs = normaliseAssessmentConfig({ track: 'customer_service', level: 'agent', options: { typingProfile: 'chat', typingNetWpm: 30 } })
  assert.deepEqual(cs.options, { typingProfile: 'chat', typingNetWpm: 30 })
  assert.equal(normaliseAssessmentConfig({ track: 'customer_service', level: 'agent', options: { typingProfile: 'telepathy' } }).options.typingProfile, 'voice')
  assert.throws(() => normaliseAssessmentConfig({ track: 'telesales', level: 'agent' }), /available/)
})

test('a test without code draws only language-neutral items', () => {
  const bank = []
  let n = 0
  const add = (extra, count) => { for (let i = 0; i < count; i++) bank.push({ id: `g-${++n}`, tracks: ['general'], levels: ['staff'], language: null, format: 'concept', primary_skill_code: `s.${n % 5}`, content: { choices: ['a', 'b', 'c', 'd'] }, ...extra }) }
  add({ type: 'sjt' }, 12); add({ type: 'scenario_response', content: { min_words: 60 } }, 2); add({ type: 'mcq' }, 30)
  add({ type: 'mcq', language: 'python', format: 'code_output' }, 5)
  const form = drawForm(getBlueprint({ track: 'general', level: 'staff' }), bank, { language: null, seed: 4 })
  assert.ok(formIsUsable(form))
  assert.equal(form.language, null)
  const byId = new Map(bank.map((b) => [b.id, b]))
  assert.ok(form.sections.flatMap((x) => x.items).every((i) => byId.get(i.itemId).language === null))
})

// ── Typing ────────────────────────────────────────────────────────────────

const PASSAGE = 'Thank you for contacting us today. I can see that your order was delayed and I am sorry for the trouble. I have arranged a refund of the delivery charge.'

test('typing: perfect, a typo, a skipped word, nothing typed', () => {
  const perfect = typingMetrics(PASSAGE, PASSAGE, 60000)
  assert.equal(perfect.errors, 0)
  assert.equal(perfect.accuracy, 100)
  assert.equal(perfect.grossWpm, perfect.netWpm)
  const typo = typingMetrics(PASSAGE, PASSAGE.replace('delayed', 'delaeyd'), 60000)
  assert.equal(typo.errors, 1)
  assert.ok(typo.netWpm < perfect.netWpm)
  const skipped = typingMetrics(PASSAGE, PASSAGE.replace(' that', ''), 60000)
  assert.equal(skipped.errors, 1, 'one skipped word is one error, not a shift of every later word')
  const half = typingMetrics(PASSAGE, PASSAGE.split(' ').slice(0, 15).join(' '), 60000)
  assert.equal(half.errors, 0, 'stopping early is not an error')
  assert.deepEqual(typingMetrics(PASSAGE, '   ', 60000).words, 0)
})

test('typing score: full at the pass mark, gentle slope below, accuracy matters', () => {
  const marks = { netWpm: 35, accuracy: 95 }
  assert.equal(typingScore({ netWpm: 50, accuracy: 99 }, marks), 1)
  assert.equal(typingScore({ netWpm: 35, accuracy: 95 }, marks), 1)
  assert.equal(typingScore({ netWpm: 17.5, accuracy: 95 }, marks), 0.7)
  assert.equal(typingScore({ netWpm: 40, accuracy: 80 }, marks), 0.6)
  assert.equal(typingScore({ netWpm: 0, accuracy: 0 }, marks), 0)
})

test('typing time: a browser claiming a short time is overruled by the server clock', () => {
  assert.equal(trustedElapsedMs(110000, 150000, 120000), 110000, 'honest: reading time allowed')
  assert.equal(trustedElapsedMs(10000, 150000, 120000), 60000, 'faked short time is lifted to server time minus reading allowance')
  assert.equal(trustedElapsedMs(999999, 150000, 120000), 125000, 'capped at the limit')
  assert.equal(trustedElapsedMs(NaN, 30000, 120000), 120000, 'missing time counts as the full limit')
})

// ── Writing ───────────────────────────────────────────────────────────────

test('writing score: weighted dimensions, must-avoid penalty, length', () => {
  const dims = [{ name: 'Empathy', weight: 0.4 }, { name: 'Solves the problem', weight: 0.6 }]
  const marked = { dimension_scores: [{ name: 'empathy', score: 1 }, { name: 'Solves the problem', score: 0.5 }], must_avoid_present: [false, false] }
  assert.equal(writingScoreFrom(dims, marked, { words: 100, minWords: 60, maxWords: 150, mustAvoidCount: 2 }).score, 0.7)
  const promised = writingScoreFrom(dims, { ...marked, must_avoid_present: [true, false] }, { words: 100, minWords: 60, maxWords: 150, mustAvoidCount: 2 })
  assert.ok(Math.abs(promised.score - 0.63) < 1e-9, 'breaking a must-avoid rule costs 0.07')
  const short = writingScoreFrom(dims, marked, { words: 30, minWords: 60, maxWords: 150, mustAvoidCount: 2 })
  assert.ok(Math.abs(short.score - 0.35) < 1e-9, 'half the minimum length halves the score')
  const junk = writingScoreFrom(dims, { dimension_scores: [{ name: 'Empathy', score: 9 }], must_avoid_present: [true, true, true, true] }, { words: 100, minWords: 60, maxWords: 150, mustAvoidCount: 2 })
  assert.ok(junk.score >= 0 && junk.score <= 1)
})

test('integrity: typing paste attempts and robotic key rhythm are noted', () => {
  const typing = (raw) => [{ type: 'typing', raw_response: raw }]
  assert.equal(summariseIntegrity([], typing({ pasteAttempts: 0, stats: { fastShare: 0.02, keystrokes: 400 } })).level, 'clear')
  assert.match(summariseIntegrity([], typing({ pasteAttempts: 3, stats: { fastShare: 0.02, keystrokes: 400 } })).notes[0], /paste into the typing test 3/)
  assert.match(summariseIntegrity([], typing({ pasteAttempts: 0, stats: { fastShare: 0.8, keystrokes: 400 } })).notes[0], /automated/)
})

import { markerComplete } from '../lib/written-scoring.js'

test('a marker answer missing any criterion is rejected, never read as zeros', () => {
  const names = ['Clear purpose', 'Complete facts', 'Next step']
  assert.equal(markerComplete([{ name: 'Clear purpose', score: 1 }], names), false, 'only the first criterion: incomplete')
  assert.equal(markerComplete(names.map((n) => ({ name: n.toLowerCase(), score: 0.5 })), names), true, 'names match ignoring case')
  assert.equal(markerComplete([...names.slice(0, 2).map((n) => ({ name: n, score: 1 })), { name: 'Next step', score: '<0-1>' }], names), false, 'an unfilled template value is not a score')
  assert.equal(markerComplete([{ id: 'sql_injection', found: 1 }, { id: 'n_plus_one', found: 0 }], ['sql_injection', 'n_plus_one'], 'id'), true)
  assert.equal(markerComplete([{ id: 'sql_injection', found: 1 }], ['sql_injection', 'n_plus_one'], 'id'), false)
  assert.equal(markerComplete(null, names), false)
})
