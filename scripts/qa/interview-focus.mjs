// Leaving the AI interview, in a real browser on the local test stack: the
// interview runs in full screen, leaving covers it, and the third time ends it.
import { BASE, db, one, user, check, launch, loginAs, finish } from './_lib.mjs'

const cand = await one(`SELECT id FROM auth.users WHERE email = $1`, [user('candidate').email])
await db.query(`UPDATE user_profiles SET account_type = 'candidate' WHERE user_id = $1`, [cand.id])
await db.query(`DELETE FROM interview_sessions WHERE user_id = $1 AND job_id IS NULL`, [cand.id])
await db.query(`DELETE FROM interview_attempt_grants WHERE user_id = $1`, [cand.id])
await db.query(`DELETE FROM expert_assessments WHERE candidate_user_id = $1`, [cand.id])

const browser = await launch(['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'])
try {
  const { ctx, page } = await loginAs(browser, 'candidate', { permissions: ['microphone'] })
  const isFull = () => page.evaluate(() => Boolean(document.fullscreenElement))
  const cover = page.getByRole('heading', { name: 'Come back to your interview' })

  await page.goto(`${BASE}/dashboard/domain-expert`, { waitUntil: 'networkidle' })
  const start = page.getByRole('button', { name: /Start Interview/ })
  await start.waitFor({ timeout: 120000 })
  check('the start button shows the attempt', /attempt 1 of 2/.test(await start.innerText()), await start.innerText())
  check('the rules are shown before starting', await page.getByText(/Leaving 3 times, or for more than 30 seconds in total, ends the interview/).isVisible())

  await start.click()
  await page.waitForFunction(() => document.fullscreenElement, null, { timeout: 10000 }).catch(() => {})
  check('starting enters full screen', await isFull())
  // Wait for Maya's first question so the interview is under way.
  await page.waitForFunction(async () => true, null, { timeout: 1000 })
  for (let i = 0; i < 60; i++) {
    const n = (await db.query(`SELECT jsonb_array_length(messages) AS n FROM interview_sessions WHERE user_id = $1 AND job_id IS NULL`, [cand.id])).rows[0]?.n
    if (n > 0) break
    await page.waitForTimeout(1000)
  }
  check('no cover while they stay', !(await cover.isVisible()))

  // Leave twice and come back: covered, then uncovered.
  for (const n of [1, 2]) {
    await page.evaluate(() => document.exitFullscreen())
    await page.waitForTimeout(2200) // past the 1.5 s grace, so it counts
    check(`leaving (time ${n}) covers the interview`, await cover.isVisible())
    if (n === 2) check('the cover says how many more end it', await page.getByText(/You have left the interview 2 times\. 1 more ends it\./).isVisible())
    await page.getByRole('button', { name: 'Return to the interview' }).click()
    await page.waitForTimeout(800)
    check(`returning (time ${n}) restores full screen and removes the cover`, (await isFull()) && !(await cover.isVisible()))
  }

  // A very short slip (under the grace time) does not count.
  await page.evaluate(() => document.exitFullscreen())
  await page.waitForTimeout(300)
  await page.getByRole('button', { name: 'Return to the interview' }).click()
  await page.waitForTimeout(2500)
  check('a moment out of full screen does not end it', !(await page.getByRole('heading', { name: 'The interview has ended' }).isVisible()))

  // The third real time ends it (no answers yet, so it simply ends).
  await page.evaluate(() => document.exitFullscreen())
  await page.getByRole('heading', { name: 'The interview has ended' }).waitFor({ timeout: 15000 }).catch(() => {})
  check('the third time ends the interview', await page.getByRole('heading', { name: 'The interview has ended' }).isVisible())
  const s = await one(`SELECT status, focus_events FROM interview_sessions WHERE user_id = $1 AND job_id IS NULL ORDER BY started_at DESC LIMIT 1`, [cand.id])
  const lefts = (s?.focus_events || []).filter((e) => e.kind === 'left').length
  check('the server has the session closed with 3 times recorded', s?.status === 'abandoned' && lefts === 3, `${s?.status}, ${lefts} left`)

  // The attempt was used: the page now offers attempt 2 of 2.
  await page.goto(`${BASE}/dashboard/domain-expert`, { waitUntil: 'networkidle' })
  const again = page.getByRole('button', { name: /Start Interview/ })
  await again.waitFor({ timeout: 120000 }).catch(() => {})
  check('the ended interview used an attempt', /attempt 2 of 2/.test(await again.innerText().catch(() => '')))
  await ctx.close()
} finally {
  await db.query(`DELETE FROM interview_sessions WHERE user_id = $1 AND job_id IS NULL`, [cand.id])
  await browser.close()
}
await finish()
