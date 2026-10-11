// Production-readiness checks.
//   Unit (needs the local database): node --test scripts/test-production.mjs
//   Plus the live-route checks against a running server:
//     BASE=http://localhost:3050 node --test scripts/test-production.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

for (const line of readFileSync(new URL('../.env.local', import.meta.url), 'utf8').split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.+?)\s*$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2]
}
const { rateLimit, clientIp } = await import('../lib/rate-limit.js')
const { rankJobs, resumeKeywords, tokenize } = await import('../lib/job-match.js')
const { query } = await import('../lib/db.js')

const fakeReq = (ip) => ({ headers: new Headers({ 'x-forwarded-for': `${ip}, 10.0.0.1` }) })

test('rate limit: allows up to the limit, then refuses; callers are counted separately', async () => {
  const bucket = `test-${Date.now()}`
  const opts = { limit: 2, windowSec: 3600 }
  assert.equal((await rateLimit(fakeReq('1.1.1.1'), bucket, opts)).ok, true)
  assert.equal((await rateLimit(fakeReq('1.1.1.1'), bucket, opts)).ok, true)
  const third = await rateLimit(fakeReq('1.1.1.1'), bucket, opts)
  assert.equal(third.ok, false)
  assert.ok(third.retryAfter > 0 && third.retryAfter <= 3600)
  assert.equal((await rateLimit(fakeReq('2.2.2.2'), bucket, opts)).ok, true, 'another address has its own count')
  assert.equal((await rateLimit(fakeReq('1.1.1.1'), bucket, { ...opts, userId: 'u1' })).ok, true, 'a logged-in user is counted by account')
  await query(`DELETE FROM rate_limits WHERE key LIKE $1`, [`${bucket}:%`])
})

test('rate limit: the first forwarded address is the visitor', () => {
  assert.equal(clientIp(fakeReq('9.9.9.9')), '9.9.9.9')
  assert.equal(clientIp({ headers: new Headers() }), 'unknown')
})

test('job matching: title words count most; unrelated resumes match nothing', () => {
  const jobs = [
    { id: 1, title: 'Backend Engineer (Python)', description: 'APIs with FastAPI and PostgreSQL' },
    { id: 2, title: 'Customer Service Agent', description: 'Answer customer calls and emails politely' },
  ]
  const ranked = rankJobs(jobs, 'Python developer. FastAPI, PostgreSQL, REST APIs, Docker. Python backend services.')
  assert.equal(ranked[0].id, 1)
  assert.ok(ranked[0].match_score > ranked[1].match_score)
  assert.ok(ranked[0].match_pct > 0 && ranked[0].match_pct <= 100)
  assert.equal(rankJobs(jobs, '').every((j) => j.match_score === 0), true)
  assert.deepEqual(tokenize('The C# and C++ developer'), ['c#', 'c++', 'developer'])
  assert.ok(!resumeKeywords('the and for with experience').length, 'stop words are ignored')
})

const BASE = process.env.BASE
test('routes that cost money or change data refuse visitors who are not logged in', { skip: !BASE && 'set BASE to run' }, async () => {
  const id = '00000000-0000-0000-0000-000000000000'
  const json = { 'content-type': 'application/json' }
  const cases = [
    ['PATCH', `/api/candidates/${id}`, '{"decision":"hire"}'],
    ['POST', '/api/eie/score', '{}'], ['POST', '/api/eie/outcome', '{"assessmentId":1,"success":true}'],
    ['POST', '/api/eie/calibration', '{}'], ['POST', '/api/eie/fairness', '{}'],
    ['POST', '/api/interview', '{}'], ['POST', '/api/interview/prime', '{}'], ['POST', '/api/interview/plan/next', '{}'],
    ['POST', '/api/tts', '{"text":"hi"}'], ['POST', '/api/stt', '{}'], ['POST', '/api/upload-resume', '{}'],
    ['GET', '/api/jobs/matched', null],
  ]
  for (const [method, path, body] of cases) {
    const res = await fetch(BASE + path, { method, headers: json, body: body ?? undefined, redirect: 'manual' })
    assert.equal(res.status, 401, `${method} ${path} should need a login`)
  }
  const gone = await fetch(`${BASE}/api/jobs/from-external`, { method: 'POST', headers: json, body: '{}' })
  assert.ok([404, 405].includes(gone.status), 'the external-job route is removed')
})

test('public pages: no calls to the old hosted backend, honest home page, reset pages exist', { skip: !BASE && 'set BASE to run' }, async () => {
  const home = await (await fetch(`${BASE}/`)).text()
  assert.ok(!/hf\.space|glassdoor|Integrated with Global Leaders/i.test(home), 'no old backend or partner claims on the home page')
  assert.match(home, /How JobStream works/)
  const chatbot = await (await fetch(`${BASE}/chatbot.js`)).text()
  assert.ok(!/hf\.space/.test(chatbot), 'the chat widget uses our own routes')
  for (const path of ['/forgot-password', '/reset-password']) {
    assert.equal((await fetch(BASE + path)).status, 200, `${path} loads`)
  }
  const login = await (await fetch(`${BASE}/login`)).text()
  assert.match(login, /Forgot password\?/)
  const analytics = await fetch(`${BASE}/analytics`, { redirect: 'manual' })
  assert.ok([307, 308].includes(analytics.status) && /\/admin\/analytics|\/login/.test(analytics.headers.get('location') || ''), 'public stats page moved to admin')
})

test.after(async () => { (await import('../lib/db.js')).getPool?.().end?.() })
