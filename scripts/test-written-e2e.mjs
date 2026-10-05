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
  const { rows: [it] } = await db.query(`SELECT type, content, scoring_rubric, reference_answer FROM items WHERE id = $1`, [itemId])
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
  if (it.type === 'typing') {
    const words = it.content.passage.split(/\s+/)
    if (strong) return { typed: words.slice(0, Math.round(words.length * 0.6)).join(' '), elapsedMs: 120000, pasteAttempts: 0, stats: { keystrokes: 900, fastShare: 0.01, meanMs: 160 } }
    const typo = (w, i) => (i % 3 === 0 ? w.split('').reverse().join('') : w)
    return { typed: words.slice(0, 15).map(typo).join(' '), elapsedMs: 120000, pasteAttempts: 0, stats: { keystrokes: 90, fastShare: 0, meanMs: 900 } }
  }
  if (it.type === 'scenario_response') return { text: strong ? it.reference_answer : 'ok sorry' }
  return { text: strong ? 'A careful, structured answer.' : '' }
}

async function playThrough({ strong, language, integrityEvents = null, track = 'backend', level = 'L3', options = {} }) {
  const start = await call('/api/assessment/start', { method: 'POST', body: { mode: 'written', track, level, language, options } })
  assert.equal(start.status, 200, JSON.stringify(start.data))
  const { sessionId, token } = start.data
  assert.equal(start.data.status, 'section_intro')
  assertNoSecrets(start.data, 'start')

  let state = (await call(`/api/assessment/${sessionId}/begin`, { method: 'POST', token })).data
  if (integrityEvents) {
    const ev = await call(`/api/assessment/${sessionId}/events`, { method: 'POST', body: { token, events: integrityEvents.map((e) => ({ ...e, itemId: state.item.id })) } })
    assert.equal(ev.status, 200, JSON.stringify(ev.data))
    assert.equal(ev.data.stored, integrityEvents.length)
    const noToken = await call(`/api/assessment/${sessionId}/events`, { method: 'POST', body: { events: integrityEvents } })
    assert.equal(noToken.status, 403, 'events need the token')
  }
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
  const { rows: [report] } = await db.query(`SELECT overall_score, band, sections, skill_map, validation, summary, integrity, followups FROM assessment_reports WHERE session_id = $1`, [sessionId])
  report.typing = (await db.query(`SELECT ir.ai_evaluation FROM item_responses ir JOIN items i ON i.id = ir.item_id WHERE ir.session_id = $1 AND i.type = 'typing'`, [sessionId])).rows.map((r) => r.ai_evaluation)
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

// A job's test, driven through the library (a real login cannot be scripted):
// the job's settings win, login is required, an unfinished attempt resumes, a
// finished one cannot be retaken, and the company report checks the resume.
async function jobFlow() {
  const lib = await import('../lib/written-assessment.js')
  const company = '00000000-0000-4000-8000-00000000c0de'
  const candidate = '00000000-0000-4000-8000-0000000ca11d'
  await db.query(`DELETE FROM assessment_sessions WHERE candidate_user_id = $1`, [candidate])
  await db.query(
    `INSERT INTO user_profiles (user_id, full_name, account_type, resume_text) VALUES ($1, 'Test Candidate', 'candidate', $2)
     ON CONFLICT (user_id) DO UPDATE SET resume_text = EXCLUDED.resume_text`,
    [candidate, `Backend engineer, 6 years.
Designed and built REST APIs with versioning and pagination for a payments platform.
Expert in PostgreSQL query tuning, indexes and transactions.
Secured services against SQL injection and handled authentication with JWT.
Wrote unit and integration tests for every service.`]
  )
  const { rows: [job] } = await db.query(
    `INSERT INTO interview_jobs (slug, title, role, description, owner_id, required_assessments, requires_ai_interview, assessment_config)
     VALUES ($1, 'Backend Engineer (Python)', 'Backend Engineer', 'Python APIs', $2, '{swe-backend}', false, $3::jsonb) RETURNING id`,
    [`e2e-${Date.now()}`, company, JSON.stringify({ track: 'backend', level: 'L3', languages: ['python'], disabledSections: [] })]
  )
  await assert.rejects(lib.createSession({ candidateUserId: null, jobId: job.id, language: 'python' }), /log in/, 'login required')
  await assert.rejects(lib.createSession({ candidateUserId: candidate, jobId: job.id, language: 'javascript', track: 'backend', level: 'L4' }), /Python/, 'job languages enforced')
  const first = await lib.createSession({ candidateUserId: candidate, jobId: job.id, language: 'python', track: 'backend', level: 'L4' })
  const again = await lib.createSession({ candidateUserId: candidate, jobId: job.id, language: 'python' })
  assert.equal(again.sessionId, first.sessionId, 'unfinished attempt is resumed')
  assert.equal(again.resumed, true)
  let session = await lib.loadSession(first.sessionId)
  assert.equal(session.seniority_band, 'L3', 'the job decides the level, not the request')
  assert.ok(lib.canAccess(session, { userId: candidate }), 'owner login gives access')
  assert.ok(!lib.canAccess(session, { userId: company }), 'another login does not')

  let state = await lib.beginSection(session)
  while (state.status !== 'completed') {
    session = await lib.loadSession(first.sessionId)
    if (state.status === 'section_intro') { state = await lib.beginSection(session); continue }
    const response = await answerFor(false, first.sessionId, state.item, 'python')
    state = await lib.submitAnswer(session, { itemId: state.item.id, response, timeSpentMs: 20000 })
  }
  await assert.rejects(lib.createSession({ candidateUserId: candidate, jobId: job.id, language: 'python' }), /already completed/, 'no retakes')

  const { rows: done } = await db.query(
    `SELECT role_family FROM assessment_sessions WHERE job_id = $1 AND candidate_user_id = $2 AND state IN ('submitted','completed')`,
    [job.id, candidate])
  assert.deepEqual(done.map((r) => r.role_family), ['swe-backend'], 'counts as done on the application page')

  const rep = await lib.companyReport(first.sessionId)
  assert.equal(rep.job.ownerId, company)
  assert.equal(rep.candidate.name, 'Test Candidate')
  assert.ok(rep.report.resumeCheck?.claims?.length > 0, `resume claims found: ${JSON.stringify(rep.report.resumeCheck)}`)
  for (const c of rep.report.resumeCheck.claims) {
    const { rows: [p] } = await db.query(`SELECT resume_text FROM user_profiles WHERE user_id = $1`, [candidate])
    assert.ok(p.resume_text.toLowerCase().replace(/\s+/g, ' ').includes(c.quote.toLowerCase().replace(/\s+/g, ' ')), `quote is real: ${c.quote}`)
  }
  assert.ok(rep.report.resumeCheck.claims.some((c) => c.verdict === 'not_confirmed'), 'a weak result does not back up an "expert" CV')
  assert.ok(rep.report.followups.some((q) => /Your CV says/.test(q.question)), 'interview follow-up asks about the CV claim')
  assert.ok(rep.coding.length === 1 && rep.coding[0].tests?.total > 0)
  console.log(`✓ job flow: settings enforced, login required, resume, no retake; resume check ${JSON.stringify(rep.report.resumeCheck.summary)}; ${rep.report.followups.length} follow-ups`)
  for (const c of rep.report.resumeCheck.claims) console.log(`    ${c.verdict.padEnd(13)} "${c.quote}"`)
  return first.sessionId
}

// E2E_ONLY=nonswe runs just the non-software families (quicker while iterating).
const ONLY_NONSWE = process.env.E2E_ONLY === 'nonswe'
try {
  if (ONLY_NONSWE) { await nonSwe(); console.log('\nE2E PASSED (non-software only)'); process.exit(0) }
  const jobSession = await jobFlow()
  console.log(`  company report preview: ${BASE}/dev/written-report/${jobSession}`)
  const opts = (await call('/api/assessment/start')).data
  const languages = opts.languages.map((l) => l.key)
  console.log('Languages offered:', languages.join(', '))
  await securityChecks()
  for (const language of languages.filter((l) => l !== 'typescript')) {
    const events = language === 'javascript'
      ? [{ kind: 'tab_hidden', ms: 75000 }, { kind: 'paste', chars: 640 }, { kind: 'bogus', ms: 1 }]
      : null
    const strong = await playThrough({ strong: true, language, integrityEvents: events && events.filter((e) => e.kind !== 'bogus') })
    const weak = await playThrough({ strong: false, language })
    const line = (r) => `${r.report.overall_score * 10} (${r.report.band}) ${r.report.sections.map((s) => `${s.key}:${s.score}`).join(' ')}`
    console.log(`${language} strong: ${line(strong)}  answered ${strong.answered}`)
    console.log(`${language} weak:   ${line(weak)}  answered ${weak.answered}`)
    assert.ok(strong.report.overall_score > weak.report.overall_score + 4, 'strong candidate clearly beats weak')
    assert.equal(strong.report.sections.find((s) => s.key === 'knowledge').score, 100, 'all knowledge right = 100')
    assert.ok(strong.report.sections.find((s) => s.key === 'review').score >= 70, 'the ideal code review is marked as good')
    assert.equal(weak.report.sections.find((s) => s.key === 'judgement').score <= 34, true, 'worst judgement options score low')
    assert.ok(strong.final.result?.sections?.length, 'candidate sees section feedback')
    assert.ok(!('score' in (strong.final.result.sections[0] || {})), 'candidate does not see numbers')
    assert.equal(strong.report.integrity.level, events ? 'review' : 'clear', 'integrity notes follow the signals')
    assert.equal(weak.report.integrity.level, 'clear')
    assert.ok(strong.report.followups.length >= 1, 'follow-up questions written')
    console.log(`  report flags: ${JSON.stringify(strong.report.validation.flags)}; summary: ${strong.report.summary ? 'yes' : 'no'}; integrity: ${strong.report.integrity.level} ${JSON.stringify(strong.report.integrity.notes)}`)
  }
  // Frontend (JavaScript only) and Full stack (half backend, half frontend).
  const py = await call('/api/assessment/start', { method: 'POST', body: { mode: 'written', track: 'frontend', level: 'L3', language: 'python' } })
  assert.equal(py.status, 400, 'Frontend refuses Python')
  for (const [track, language] of [['frontend', 'javascript'], ['fullstack', 'python'], ['fullstack', 'typescript']]) {
    const strong = await playThrough({ strong: true, language, track })
    const weak = await playThrough({ strong: false, language, track })
    const line = (r) => `${r.report.overall_score * 10} (${r.report.band}) ${r.report.sections.map((s) => `${s.key}:${s.score}`).join(' ')}`
    console.log(`${track}/${language} strong: ${line(strong)}`)
    console.log(`${track}/${language} weak:   ${line(weak)}`)
    assert.ok(strong.report.overall_score > weak.report.overall_score + 4, `${track}: strong clearly beats weak`)
    assert.equal(strong.report.sections.find((s) => s.key === 'knowledge').score, 100)
    const { rows: drawn } = await db.query(
      `SELECT i.tracks, i.type, i.content FROM item_responses ir JOIN items i ON i.id = ir.item_id
       JOIN assessment_sessions s ON s.id = ir.session_id WHERE s.id = $1`, [strong.sessionId])
    assert.ok(drawn.every((d) => d.tracks.includes(track)), `${track}: only ${track} items drawn`)
    if (language === 'python') {
      assert.ok(drawn.filter((d) => d.type === 'coding').every((d) => d.content.function_name.python), 'Python candidate only gets Python-ready coding tasks')
    }
    if (track === 'fullstack') {
      const concept = drawn.filter((d) => d.type === 'mcq' || d.type === 'multi_select')
      const fe = concept.filter((d) => d.tracks.includes('frontend')).length
      const be = concept.filter((d) => d.tracks.includes('backend')).length
      const only = concept.filter((d) => d.tracks.length === 1).length
      console.log(`  full stack knowledge mix: ${be} backend-side, ${fe} frontend-side, ${only} full-stack-only (shared items count for both sides)`)
      assert.ok(fe >= 7 && be >= 7 && only === 3, 'full stack mixes both sides plus 3 full-stack questions')
    }
  }

  await nonSwe()

  console.log('\nE2E PASSED')
} catch (e) {
  console.error('\nE2E FAILED:', e.message)
  process.exitCode = 1
} finally {
  await db.end()
  await globalThis._pgPool?.end?.()
}

async function nonSwe() {
  // General workplace (Staff, Manager) and Customer service (phone, chat): no code.
  for (const [track, level, options] of [['general', 'staff', {}], ['general', 'manager', {}], ['customer_service', 'agent', {}], ['customer_service', 'agent', { typingProfile: 'chat' }]]) {
    const label = `${track}/${level}${options.typingProfile ? `/${options.typingProfile}` : ''}`
    const strong = await playThrough({ strong: true, language: null, track, level, options })
    const weak = await playThrough({ strong: false, language: null, track, level, options })
    const line = (r) => `${r.report.overall_score * 10} (${r.report.band}) ${r.report.sections.map((x) => `${x.key}:${x.score}`).join(' ')}`
    console.log(`${label} strong: ${line(strong)}`)
    console.log(`${label} weak:   ${line(weak)}`)
    assert.ok(strong.report.overall_score > weak.report.overall_score + 4, `${label}: strong clearly beats weak`)
    // The model answer must be marked as good: catches a marker that silently
    // drops criteria (found 5 Oct: the 4b model scored only the first one).
    for (const key of ['written_communication', 'written_reply']) {
      const sec = strong.report.sections.find((x) => x.key === key)
      if (sec) assert.ok(sec.score >= 70, `${label}: the model answer to the ${key} task scored only ${sec.score}`)
    }
    const { rows: [sess] } = await db.query(`SELECT language, form FROM assessment_sessions WHERE id = $1`, [strong.sessionId])
    assert.equal(sess.language, null, `${label}: no coding language`)
    if (track === 'customer_service') {
      const t = strong.report.typing[0]
      const want = options.typingProfile === 'chat' ? 35 : 25
      assert.equal(t.pass_marks.net_wpm, want, `${label}: the right typing pass mark`)
      assert.equal(t.passed, true, `${label}: a good typist passes`)
      assert.equal(weak.report.typing[0].passed, false, `${label}: a slow, error-prone typist does not`)
      console.log(`  typing strong ${t.netWpm} wpm ${t.accuracy}% | weak ${weak.report.typing[0].netWpm} wpm ${weak.report.typing[0].accuracy}%`)
    }
  }
}
