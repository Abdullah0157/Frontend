// Interview attempts and leaving the interview, on the local test stack.
//   - Maya (expert interview): 2 attempts per account; starting one counts.
//   - Iris (job interview): 1 attempt per job.
//   - The admin can give one more attempt.
//   - Leaving the interview is recorded; the third time ends it.
import { BASE, db, one, stamp, user, check, launch, loginAs, interviewCall, newId, finish } from './_lib.mjs'

const cand = await one(`SELECT id FROM auth.users WHERE email = $1`, [user('candidate').email])
await db.query(`UPDATE user_profiles SET account_type = 'candidate' WHERE user_id = $1`, [cand.id])
// Start from a clean slate for this candidate.
await db.query(`DELETE FROM interview_sessions WHERE user_id = $1`, [cand.id])
await db.query(`DELETE FROM interview_attempt_grants WHERE user_id = $1`, [cand.id])
await db.query(`DELETE FROM expert_assessments WHERE candidate_user_id = $1`, [cand.id])
const job = await one(
  `INSERT INTO interview_jobs (slug, title, role, description, requires_ai_interview)
   VALUES ($1, $2, 'Customer support agent', 'Answer customer emails and calls for an online shop.', true) RETURNING id, slug`,
  [`attempts-test-${stamp}`, `Attempts Test Agent ${stamp}`])
const maya = (sessionId, extra = {}) => ({ sessionId, assessmentType: 'domain_expert', domainExpertise: 'Customer support', candidate: { name: 'Test Candidate', role: 'Customer support' }, clientBelief: true, messages: [], ...extra })
const iris = (sessionId, extra = {}) => ({ sessionId, jobId: job.id, candidate: { name: 'Test Candidate', role: 'Customer support agent' }, totalQuestions: 3, messages: [], ...extra })
const session = (id) => one(`SELECT status, messages, focus_events FROM interview_sessions WHERE id = $1`, [id])

const browser = await launch(['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'])
try {
  const { ctx, page } = await loginAs(browser, 'candidate', { permissions: ['microphone', 'camera'] })

  // ── Maya: two attempts, starting one counts ──────────────────────────────
  const m1 = await newId(page), m2 = await newId(page), m3 = await newId(page)
  const a1 = await interviewCall(page, { ...maya(m1), action: 'question', focusEvents: [{ kind: 'left' }, { kind: 'back', ms: 4200 }] })
  check('Maya attempt 1 starts', a1.status === 200, `status ${a1.status}`)
  const s1 = await session(m1)
  check('leaving the interview is recorded on the server', s1?.focus_events?.length === 2 && s1.focus_events[1].ms === 4200, JSON.stringify(s1?.focus_events))
  const a2 = await interviewCall(page, { ...maya(m2), action: 'question' })
  check('Maya attempt 2 starts', a2.status === 200, `status ${a2.status}`)
  const a3 = await interviewCall(page, { ...maya(m3), action: 'question' })
  check('Maya attempt 3 is refused', a3.status === 409 && /both of your expert interview attempts/.test(a3.text), `status ${a3.status}`)
  const again = await interviewCall(page, { ...maya(m1), action: 'question', messages: [{ role: 'assistant', content: (await session(m1)).messages[0].content }, { role: 'user', content: 'I have run a support desk for three years.' }] })
  check('an attempt already started can continue', again.status === 200, `status ${again.status}`)

  // The page says so before they start.
  await page.goto(`${BASE}/dashboard/domain-expert`, { waitUntil: 'networkidle' })
  await page.getByText(/used all 2 of your expert interview attempts/).waitFor({ timeout: 90000 }).catch(() => {})
  check('the Maya page shows the attempts are used up', await page.getByText(/used all 2 of your expert interview attempts/).isVisible())
  check('the Maya page has no Start button then', !(await page.getByRole('button', { name: /Start Interview/ }).count()))

  // ── Iris: one attempt per job ────────────────────────────────────────────
  const i1 = await newId(page), i2 = await newId(page)
  const b1 = await interviewCall(page, { ...iris(i1), action: 'question' })
  check('Iris attempt 1 starts', b1.status === 200, `status ${b1.status}`)
  const b2 = await interviewCall(page, { ...iris(i2), action: 'question' })
  check('Iris attempt 2 for the same job is refused', b2.status === 409 && /already used your AI interview attempt/.test(b2.text), `status ${b2.status}`)
  await page.goto(`${BASE}/interview/${job.slug}/session`, { waitUntil: 'networkidle' })
  check('the interview page says the attempt is used', await page.getByRole('heading', { name: 'You have used your interview attempt' }).isVisible())
  await page.goto(`${BASE}/dashboard/apply/${job.slug}`, { waitUntil: 'networkidle' })
  await page.getByRole('heading', { name: `Attempts Test Agent ${stamp}` }).waitFor({ timeout: 20000 }).catch(() => {})
  check('the application says the attempt was used', await page.getByText(/Your attempt was used/).isVisible())

  // Ending because they kept leaving: the attempt stays used.
  const end = await interviewCall(page, { ...iris(i1), action: 'end', endedReason: 'left', focusEvents: [{ kind: 'left' }, { kind: 'back', ms: 2000 }, { kind: 'left' }, { kind: 'back', ms: 3000 }, { kind: 'left' }] })
  const e1 = await session(i1)
  check('ending for leaving closes the session and keeps the events', end.status === 200 && e1.status === 'abandoned' && e1.focus_events.filter((e) => e.kind === 'left').length === 3, `${e1.status}, ${e1.focus_events.length} events`)

  // A candidate cannot give themselves attempts.
  const self = await page.evaluate(async (u) => (await fetch('/api/admin/interview-attempts', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ userId: u }) })).status, cand.id)
  check('a candidate cannot give themselves an attempt', self === 403, `status ${self}`)

  // ── The admin gives one more attempt ─────────────────────────────────────
  const admin = await loginAs(browser, 'super_admin')
  await admin.page.goto(`${BASE}/admin/candidates/${cand.id}`, { waitUntil: 'networkidle' })
  await admin.page.getByText(/Expert interview:/).waitFor({ timeout: 20000 }).catch(() => {})
  const adminText = (await admin.page.evaluate(() => document.body.innerText)).replace(/\s+/g, ' ')
  check('the admin sees attempts used', /Expert interview: 2 of 2 attempts used/.test(adminText) && new RegExp(`Attempts Test Agent ${stamp}.*?AI interview: 1 of 1 attempts used`).test(adminText), adminText.match(/(Expert|AI) interview: [^.]{0,30}/g)?.join(' | '))
  await admin.page.locator('span', { hasText: /^Expert interview:/ }).getByRole('button', { name: 'Give one more attempt' }).click()
  await admin.page.getByText('Expert interview: 2 of 3 attempts used').waitFor({ timeout: 15000 }).catch(() => {})
  check('the admin can give one more Maya attempt', await admin.page.getByText('Expert interview: 2 of 3 attempts used').isVisible())
  const jobGrant = await admin.page.evaluate(async ([u, j]) => (await fetch('/api/admin/interview-attempts', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ userId: u, jobId: j }) })).json(), [cand.id, job.id])
  check('the admin can give one more Iris attempt for a job', jobGrant?.attempts?.left === 1, JSON.stringify(jobGrant))
  await admin.ctx.close()

  const a3b = await interviewCall(page, { ...maya(m3), action: 'question' })
  check('with the extra attempt, Maya starts again', a3b.status === 200, `status ${a3b.status}`)
  const b2b = await interviewCall(page, { ...iris(i2), action: 'question' })
  check('with the extra attempt, Iris starts again', b2b.status === 200, `status ${b2b.status}`)

  // ── The report records leaving (Maya report, written by the local AI) ────
  const s3 = await session(m3)
  const rep = await interviewCall(page, { ...maya(m3), action: 'report', endedReason: 'left',
    focusEvents: [{ kind: 'left' }, { kind: 'back', ms: 8000 }, { kind: 'left' }, { kind: 'back', ms: 9000 }, { kind: 'left' }],
    messages: [{ role: 'assistant', content: s3.messages[0].content }, { role: 'user', content: 'I lead a team of six support agents and wrote our refund guide.' }] })
  check('the report is saved', rep.status === 200 && rep.json?.saved === true, `status ${rep.status} ${rep.text.slice(0, 120)}`)
  const saved = await one(`SELECT report FROM expert_assessments WHERE candidate_user_id = $1 ORDER BY created_at DESC LIMIT 1`, [cand.id])
  const notes = saved?.report?.integrity?.notes || []
  check('the report notes the leaving and the early end', notes.some((n) => /Left the interview 3 time/.test(n)) && notes.some((n) => /ended early/.test(n)), JSON.stringify(notes))
  await ctx.close()
} finally {
  await db.query(`DELETE FROM interview_jobs WHERE id = $1`, [job.id])
  await db.query(`DELETE FROM interview_sessions WHERE user_id = $1`, [cand.id])
  await db.query(`DELETE FROM interview_attempt_grants WHERE user_id = $1`, [cand.id])
  await db.query(`DELETE FROM expert_assessments WHERE candidate_user_id = $1`, [cand.id])
  await browser.close()
}
await finish()
