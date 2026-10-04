// End-to-end test of the written assessment over real HTTP, against a LOCAL
// database (it reads answer keys from the DB to play a strong candidate).
//
//   BASE=http://localhost:3050 node scripts/test-written-e2e.mjs
//
// Plays a strong candidate (right answers, reference code, ideal review) and
// a weak one (wrong answers, broken code, empty review) in each language, and
// checks: the strong one scores clearly higher; answer keys never reach the
// browser; no token = no access; only the current question is accepted; a
// double submit records one answer; an expired section closes itself.

import { readFileSync } from 'node:fs'
import assert from 'node:assert/strict'
import pg from 'pg'

try {
  const env = readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
  for (const line of env.split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.+?)\s*$/)
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2]
  }
} catch {}

const BASE = process.env.BASE || 'http://localhost:3050'
const host = new URL(process.env.DATABASE_URL).hostname
if (!['localhost', '127.0.0.1'].includes(host)) throw new Error('e2e must run against a local database')
const db = new pg.Pool({ connectionString: process.env.DATABASE_URL, ssl: false })

const FORBIDDEN = ['scoring_rubric', 'answer', 'hidden_tests', 'correct', 'points', 'reference', 'wrong', 'issues', 'ideal_answer', 'explanation']
function assertNoSecrets(obj, where) {
  const walk = (v, path) => {
    if (v && typeof v === 'object') {
      for (const [k, x] of Object.entries(v)) {
        assert.ok(!FORBIDDEN.includes(k), `${where}: leaked "${k}" at ${path}.${k}`)
        walk(x, `${path}.${k}`)
      }
    }
  }
  walk(obj, '$')
}

async function call(path, { method = 'GET', body, token } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { 'content-type': 'application/json', ...(token ? { 'x-assessment-token': token } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  })
  const data = await res.json().catch(() => ({}))
  return { status: res.status, data }
}

async function keyFor(sessionId, itemId) {
  const { rows: [s] } = await db.query(`SELECT form FROM assessment_sessions WHERE id = $1`, [sessionId])
  const entry = s.form.sections.flatMap((x) => x.items).find((i) => i.itemId === itemId)
  const { rows: [it] } = await db.query(`SELECT type, content, scoring_rubric FROM items WHERE id = $1`, [itemId])
  return { entry, it }
}

const shownIndex = (order, original) => (order ? order.indexOf(original) : original)

async function answerFor(strong, sessionId, item, language) {
  const { entry, it } = await keyFor(sessionId, item.id)
  const lang = language === 'python' ? 'python' : 'javascript'
  const r = it.scoring_rubric
  if (it.type === 'mcq') {
    const right = shownIndex(entry.order, r.answer.correct)
    return { choice: strong ? right : (right + 1) % item.choices.length }
  }
  if (it.type === 'sjt') {
    const best = r.answer.points.indexOf(Math.max(...r.answer.points))
    const worst = r.answer.points.indexOf(Math.min(...r.answer.points))
    return { choice: shownIndex(entry.order, strong ? best : worst) }
  }
  if (it.type === 'multi_select') {
    const key = r.answer.correct
    const wrong = item.choices.map((_, i) => i).filter((i) => !key.includes(entry.order ? entry.order[i] : i))
    return { choices: strong ? key.map((k) => shownIndex(entry.order, k)) : wrong }
  }
  if (it.type === 'coding') return { code: strong ? r.reference[lang] : r.wrong[0][lang] }
  if (it.type === 'code_review') return { text: strong ? r.ideal_answer : 'Looks fine to me.' }
  return { text: strong ? 'A careful, structured answer.' : '' }
}

async function playThrough({ strong, language }) {
  const start = await call('/api/assessment/start', { method: 'POST', body: { mode: 'written', track: 'backend', level: 'L3', language } })
  assert.equal(start.status, 200, JSON.stringify(start.data))
  const { sessionId, token } = start.data
  assert.equal(start.data.status, 'section_intro')
  assertNoSecrets(start.data, 'start')

  let state = (await call(`/api/assessment/${sessionId}/begin`, { method: 'POST', token })).data
  let answered = 0
  let ranExamples = false
  while (state.status !== 'completed') {
    if (state.status === 'section_intro') {
      state = (await call(`/api/assessment/${sessionId}/begin`, { method: 'POST', token })).data
      continue
    }
    assert.equal(state.status, 'in_progress', JSON.stringify(state))
    assertNoSecrets(state, `item ${state.item.type}`)
    const response = await answerFor(strong, sessionId, state.item, language)
    if (state.item.type === 'coding' && !ranExamples) {
      const run = await call(`/api/assessment/${sessionId}/run`, { method: 'POST', token, body: { itemId: state.item.id, code: response.code } })
      assert.equal(run.status, 200, JSON.stringify(run.data))
      assert.equal(run.data.total, state.item.visibleTests.length, 'run uses visible tests only')
      if (strong) assert.equal(run.data.passed, run.data.total, 'reference passes the visible examples')
      ranExamples = true
    }
    const res = await call('/api/assessment/respond', { method: 'POST', token, body: { sessionId, itemId: state.item.id, response, timeSpentMs: 30000 } })
    assert.equal(res.status, 200, JSON.stringify(res.data))
    assertNoSecrets(res.data, 'respond')
    state = res.data
    answered++
  }
  const final = await call(`/api/assessment/${sessionId}`, { token })
  assertNoSecrets(final.data, 'final view')
  const { rows: [report] } = await db.query(`SELECT overall_score, band, sections, skill_map, validation, summary FROM assessment_reports WHERE session_id = $1`, [sessionId])
  assert.ok(report, 'report written')
  return { sessionId, token, answered, report, final: final.data }
}

async function securityChecks() {
  const start = await call('/api/assessment/start', { method: 'POST', body: { mode: 'written', track: 'backend', level: 'L3', language: 'javascript' } })
  const { sessionId, token } = start.data
  // No token, wrong token.
  assert.equal((await call(`/api/assessment/${sessionId}`)).status, 403, 'no token is refused')
  assert.equal((await call(`/api/assessment/${sessionId}`, { token: 'x'.repeat(48) })).status, 403, 'wrong token is refused')
  assert.equal((await call(`/api/assessment/${sessionId}/begin`, { method: 'POST' })).status, 403)
  // Answering before the section starts.
  const { rows: [s] } = await db.query(`SELECT form FROM assessment_sessions WHERE id = $1`, [sessionId])
  const firstItem = s.form.sections[0].items[0].itemId
  const early = await call('/api/assessment/respond', { method: 'POST', token, body: { sessionId, itemId: firstItem, response: { choice: 0 } } })
  assert.equal(early.status, 409, 'cannot answer before the section begins')
  // Wrong item.
  const st = (await call(`/api/assessment/${sessionId}/begin`, { method: 'POST', token })).data
  const other = s.form.sections[0].items[1].itemId
  const wrongItem = await call('/api/assessment/respond', { method: 'POST', token, body: { sessionId, itemId: other, response: { choice: 0 } } })
  assert.equal(wrongItem.status, 409, 'only the current question is accepted')
  // Double submit: exactly one is recorded.
  const both = await Promise.all([1, 2].map(() => call('/api/assessment/respond', { method: 'POST', token, body: { sessionId, itemId: st.item.id, response: { choice: 0 } } })))
  assert.deepEqual(both.map((b) => b.status).sort(), [200, 409], `double submit gave ${both.map((b) => b.status)}`)
  const { rows: [{ n }] } = await db.query(`SELECT COUNT(*)::int AS n FROM item_responses WHERE session_id = $1 AND item_id = $2`, [sessionId, st.item.id])
  assert.equal(n, 1, 'one answer recorded')
  // Section timer: pretend the section started 20 minutes ago.
  await db.query(`UPDATE assessment_sessions SET progress = jsonb_set(progress, '{sectionStartedAt}', to_jsonb(to_char((now() - interval '20 minutes') AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'))) WHERE id = $1`, [sessionId])
  const after = await call(`/api/assessment/${sessionId}`, { token })
  assert.equal(after.data.status, 'section_intro', 'expired section closed itself')
  assert.equal(after.data.sectionIndex, 1)
  const { rows: [{ skipped }] } = await db.query(
    `SELECT COUNT(*)::int AS skipped FROM item_responses WHERE session_id = $1 AND raw_response ? 'skipped'`, [sessionId])
  assert.equal(skipped, s.form.sections[0].items.length - 1, 'the rest of the section recorded as unanswered')
  // Run examples is refused outside a coding task.
  const run = await call(`/api/assessment/${sessionId}/run`, { method: 'POST', token, body: { itemId: firstItem, code: 'x' } })
  assert.equal(run.status, 409)
  console.log('✓ security: token required, order enforced, double submit blocked, timer enforced')
}

try {
  const opts = (await call('/api/assessment/start')).data
  const languages = opts.languages.map((l) => l.key)
  console.log('Languages offered:', languages.join(', '))
  await securityChecks()
  for (const language of languages.filter((l) => l !== 'typescript')) {
    const strong = await playThrough({ strong: true, language })
    const weak = await playThrough({ strong: false, language })
    const line = (r) => `${r.report.overall_score * 10} (${r.report.band}) ${r.report.sections.map((s) => `${s.key}:${s.score}`).join(' ')}`
    console.log(`${language} strong: ${line(strong)}  answered ${strong.answered}`)
    console.log(`${language} weak:   ${line(weak)}  answered ${weak.answered}`)
    assert.ok(strong.report.overall_score > weak.report.overall_score + 4, 'strong candidate clearly beats weak')
    assert.equal(strong.report.sections.find((s) => s.key === 'knowledge').score, 100, 'all knowledge right = 100')
    assert.equal(weak.report.sections.find((s) => s.key === 'judgement').score <= 34, true, 'worst judgement options score low')
    assert.ok(strong.final.result?.sections?.length, 'candidate sees section feedback')
    assert.ok(!('score' in (strong.final.result.sections[0] || {})), 'candidate does not see numbers')
    console.log(`  report flags: ${JSON.stringify(strong.report.validation.flags)}; summary: ${strong.report.summary ? 'yes' : 'no'}`)
  }
  console.log('\nE2E PASSED')
} catch (e) {
  console.error('\nE2E FAILED:', e.message)
  process.exitCode = 1
} finally {
  await db.end()
}
