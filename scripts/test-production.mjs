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
const { jobSteps, verdictFor, jobRequirements } = await import('../lib/job-verdict.js')

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
test('job verdict: steps from the job, then Recommended / Consider / Not a fit yet / Not finished', () => {
  const job = { assessment_config: { track: 'customer_service', english: { requiredLevel: 'B2' } }, requires_ai_interview: true }
  assert.deepEqual(jobRequirements(job), { track: 'customer_service', englishLevel: 'B2', interview: true })
  assert.deepEqual(jobRequirements({ required_assessments: ['swe-backend'], requires_ai_interview: false }), { track: 'backend', englishLevel: null, interview: false })
  assert.equal(jobRequirements({ assessment_config: { track: 'english', options: { requiredLevel: 'C1' } } }).englishLevel, 'C1')

  const skills = (band, extra = {}) => ({ id: 's1', track: 'customer_service', state: 'completed', band, overall_score: 7.2, integrity: { level: 'clear', notes: [] }, ...extra })
  const english = (meets) => ({ id: 'e1', track: 'english', state: 'completed', band: 'good', overall_score: 7, english: { cefr: 'B2', overall: 70, meetsRequired: meets }, integrity: { level: 'clear', notes: [] } })
  const iris = (recommendation) => ({ report: { recommendation, score: 7 } })
  const verdict = (tests, interview) => verdictFor(jobSteps(job, tests, interview)).key

  assert.equal(verdict([skills('good'), english('yes')], iris('yes')), 'recommended')
  assert.equal(verdict([skills('strong'), english('yes')], iris('strong_yes')), 'recommended')
  assert.equal(verdict([skills('borderline'), english('yes')], iris('yes')), 'consider')
  assert.equal(verdict([skills('good'), english('borderline')], iris('yes')), 'consider')
  assert.equal(verdict([skills('good'), english('yes')], iris('maybe')), 'consider')
  // Integrity notes ask for a closer look; they never reject on their own.
  const noted = skills('strong', { integrity: { level: 'review', notes: ['Left full screen 3 time(s), 40 seconds in total.'] } })
  assert.equal(verdict([noted, english('yes')], iris('yes')), 'consider')
  assert.equal(verdict([skills('not_yet'), english('yes')], iris('yes')), 'not_fit')
  assert.equal(verdict([skills('good'), english('no')], iris('yes')), 'not_fit')
  assert.equal(verdict([skills('good'), english('yes')], iris('no')), 'not_fit')
  // Below the bar wins over unfinished; unfinished wins over borderline.
  assert.equal(verdict([skills('not_yet')], null), 'not_fit')
  assert.equal(verdict([skills('borderline')], null), 'incomplete')
  assert.equal(verdict([skills(null, { state: 'submitted' }), english('yes')], iris('yes')), 'incomplete')
  assert.equal(verdict([skills('good', { state: 'in_progress', band: null }), english('yes')], iris('yes')), 'incomplete')
  assert.equal(verdict([skills('good'), english('yes')], { report: null }), 'incomplete')
  const v = verdictFor(jobSteps(job, [skills('good')], null))
  assert.deepEqual(v.reasons, ['English (needs B2)', 'AI interview (Iris)'])
  assert.equal(verdictFor([]).key, 'incomplete')
  // A test for another track does not count for this job.
  assert.equal(jobSteps(job, [{ ...skills('strong'), track: 'general' }], null)[0].status, 'missing')
})

test('routes that cost money or change data refuse visitors who are not logged in', { skip: !BASE && 'set BASE to run' }, async () => {
  const id = '00000000-0000-0000-0000-000000000000'
  const json = { 'content-type': 'application/json' }
  const cases = [
    ['PATCH', `/api/candidates/${id}`, '{"decision":"hire"}'],
    ['POST', '/api/eie/score', '{}'], ['POST', '/api/eie/outcome', '{"assessmentId":1,"success":true}'],
    ['POST', '/api/eie/calibration', '{}'], ['POST', '/api/eie/fairness', '{}'],
    ['POST', '/api/interview', '{}'], ['POST', '/api/interview/prime', '{}'], ['POST', '/api/interview/plan/next', '{}'],
    ['POST', '/api/tts', '{"text":"hi"}'], ['POST', '/api/stt', '{}'], ['POST', '/api/upload-resume', '{}'],
    ['GET', '/api/jobs/matched', null], ['GET', `/api/jobs/${id}`, null],
  ]
  for (const [method, path, body] of cases) {
    const res = await fetch(BASE + path, { method, headers: json, body: body ?? undefined, redirect: 'manual' })
    assert.equal(res.status, 401, `${method} ${path} should need a login`)
  }
  // Companies are invite-only: nobody can make themselves a company, and the
  // admin routes need an admin.
  for (const [method, path] of [['PUT', '/api/company-profile'], ['GET', '/api/admin/enquiries'], ['POST', '/api/admin/company-access']]) {
    const res = await fetch(BASE + path, { method, headers: json, body: method === 'GET' ? undefined : '{"company_name":"X","email":"a@b.c","companyName":"X"}', redirect: 'manual' })
    assert.equal(res.status, 401, `${method} ${path} should need a login`)
  }
  // Camera photos need the test's own token; the nightly clean-up needs Vercel's secret.
  const snap = await fetch(`${BASE}/api/assessment/${id}/snapshot`, { method: 'POST', headers: json, body: '{"image":"/9j/"}' })
  assert.ok([403, 404].includes(snap.status), `photo upload without the test's token is refused (got ${snap.status})`)
  assert.equal((await fetch(`${BASE}/api/cron/purge`)).status, 401, 'the clean-up job needs the cron secret')
  const gone = await fetch(`${BASE}/api/jobs/from-external`, { method: 'POST', headers: json, body: '{}' })
  assert.ok([404, 405].includes(gone.status), 'the external-job route is removed')
})

test('public pages: no calls to the old hosted backend, honest home page, reset pages exist', { skip: !BASE && 'set BASE to run' }, async () => {
  const home = await (await fetch(`${BASE}/`)).text()
  assert.ok(!/hf\.space|glassdoor|Integrated with Global Leaders/i.test(home), 'no old backend or partner claims on the home page')
  assert.match(home, /How JobStream works|How it works/)
  // Companies are invite-only and reached directly: the public pages never
  // point visitors (candidates) at company pages.
  assert.ok(!/For Companies|href="\/contact"|href="\/login\/company"/.test(home), 'no company links on public pages')
  const chatbot = await (await fetch(`${BASE}/chatbot.js`)).text()
  assert.ok(!/hf\.space/.test(chatbot), 'the chat widget uses our own routes')
  const about = await (await fetch(`${BASE}/about`)).text()
  assert.ok(!/85k\+|12k\+/.test(about), 'no made-up results on the About page')
  for (const path of ['/forgot-password', '/reset-password', '/privacy']) {
    assert.equal((await fetch(BASE + path)).status, 200, `${path} loads`)
  }
  // The login form renders in the browser, so look in the page's own script.
  const login = await (await fetch(`${BASE}/login`)).text()
  assert.match(login, /<title>Sign in \| JobStream<\/title>/, 'pages have their own titles')
  const script = /src="(\/_next\/static\/chunks\/app\/login\/page-[^"]+\.js)"/.exec(login)?.[1]
  if (script) assert.match(await (await fetch(BASE + script)).text(), /Forgot password\?/)
  else assert.match(login, /Forgot password\?/)
  // Company sign-up is replaced by the contact page; the form checks its input
  // (these calls never save anything, so they are safe against the live site).
  const companySignup = await fetch(`${BASE}/signup/company`, { redirect: 'manual' })
  assert.ok([307, 308].includes(companySignup.status) && /\/contact$/.test(companySignup.headers.get('location') || ''), 'company sign-up goes to the contact page')
  assert.equal((await fetch(`${BASE}/contact`)).status, 200, '/contact loads')
  const incomplete = await fetch(`${BASE}/api/contact`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{"name":"A"}' })
  assert.equal(incomplete.status, 400, 'an incomplete contact message is refused')
  const bot = await fetch(`${BASE}/api/contact`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{"website":"spam"}' })
  assert.equal(bot.status, 200, 'a bot that fills the hidden field is ignored quietly')
  const analytics = await fetch(`${BASE}/analytics`, { redirect: 'manual' })
  assert.ok([307, 308].includes(analytics.status) && /\/admin\/analytics|\/login/.test(analytics.headers.get('location') || ''), 'public stats page moved to admin')
})

test.after(async () => { (await import('../lib/db.js')).getPool?.().end?.() })
