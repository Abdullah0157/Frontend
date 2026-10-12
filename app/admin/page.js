import Link from 'next/link'
import { query } from '@/lib/db'
import { jobSteps, verdictFor, sessionTrack, trackLabel } from '@/lib/job-verdict'
import { ActivityChart } from './AdminCharts'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Home — JobStream Admin' }

const none = { rows: [] }

async function fetchNumbers() {
  const { rows } = await query(`
    SELECT
      (SELECT COUNT(*)::int FROM user_profiles WHERE COALESCE(account_type, 'candidate') = 'candidate') AS candidates,
      (SELECT COUNT(*)::int FROM user_profiles WHERE COALESCE(account_type, 'candidate') = 'candidate' AND created_at >= now() - interval '7 days') AS candidates_7d,
      (SELECT COUNT(*)::int FROM interview_jobs WHERE is_active IS NOT FALSE) AS open_jobs,
      (SELECT COUNT(*)::int FROM user_profiles WHERE account_type = 'company') AS companies,
      (SELECT COUNT(*)::int FROM assessment_sessions WHERE form IS NOT NULL AND state IN ('submitted', 'completed')) AS tests,
      (SELECT COUNT(*)::int FROM assessment_sessions WHERE form IS NOT NULL AND state IN ('submitted', 'completed') AND completed_at >= now() - interval '7 days') AS tests_7d,
      (SELECT COUNT(*)::int FROM interview_candidates) AS job_interviews,
      (SELECT COUNT(*)::int FROM expert_assessments) AS expert_interviews,
      (SELECT COUNT(*)::int FROM company_enquiries WHERE status = 'new') AS new_enquiries
  `).catch(() => ({ rows: [{}] }))
  return rows[0] || {}
}

// Tests finished more than 15 minutes ago with no report: marking failed or
// is stuck (usually the AI marking service was busy or out of free quota).
async function fetchStuck() {
  return (await query(`
    SELECT s.id, s.candidate_user_id, s.track, s.role_family, s.completed_at, p.full_name
    FROM assessment_sessions s
    LEFT JOIN user_profiles p ON p.user_id = s.candidate_user_id
    WHERE s.form IS NOT NULL AND s.state = 'submitted' AND s.completed_at < now() - interval '15 minutes'
      AND NOT EXISTS (SELECT 1 FROM assessment_reports r WHERE r.session_id = s.id)
    ORDER BY s.completed_at DESC LIMIT 5
  `).catch(() => none)).rows
}

async function fetchIntegrity() {
  return (await query(`
    SELECT s.id, s.job_id, s.candidate_user_id, s.track, s.role_family, r.integrity, p.full_name, j.title AS job_title
    FROM assessment_reports r
    JOIN assessment_sessions s ON s.id = r.session_id
    LEFT JOIN user_profiles p ON p.user_id = s.candidate_user_id
    LEFT JOIN interview_jobs j ON j.id = s.job_id
    WHERE r.integrity->>'level' = 'review' AND r.created_at >= now() - interval '30 days'
    ORDER BY r.created_at DESC LIMIT 5
  `).catch(() => none)).rows
}

// People who finished every step for a job, came out Recommended or Consider,
// and have no hire or reject decision yet.
async function fetchReadyToDecide() {
  const [tests, interviews] = await Promise.all([
    query(`
      SELECT s.id, s.job_id, s.candidate_user_id, s.track, s.role_family, s.state, s.started_at,
             r.overall_score, r.band, r.english, r.integrity
      FROM assessment_sessions s
      LEFT JOIN assessment_reports r ON r.session_id = s.id
      WHERE s.form IS NOT NULL AND s.job_id IS NOT NULL AND s.candidate_user_id IS NOT NULL
        AND s.started_at >= now() - interval '90 days'
      ORDER BY s.started_at DESC LIMIT 500
    `).catch(() => none),
    query(`
      SELECT id, job_id, user_id, report, decision, created_at
      FROM interview_candidates
      WHERE user_id IS NOT NULL AND created_at >= now() - interval '90 days'
      ORDER BY created_at DESC LIMIT 500
    `).catch(() => none),
  ])
  const pairs = new Map()
  const pair = (jobId, userId) => {
    const key = `${jobId}:${userId}`
    if (!pairs.has(key)) pairs.set(key, { jobId, userId, tests: [], interview: null })
    return pairs.get(key)
  }
  for (const t of tests.rows) pair(t.job_id, t.candidate_user_id).tests.push(t)
  for (const i of interviews.rows) { const p = pair(i.job_id, i.user_id); p.interview ||= i }
  if (pairs.size === 0) return []

  const jobIds = [...new Set([...pairs.values()].map((p) => p.jobId))]
  const userIds = [...new Set([...pairs.values()].map((p) => p.userId))]
  const [jobs, people] = await Promise.all([
    query(`SELECT id, title, assessment_config, required_assessments, requires_ai_interview FROM interview_jobs WHERE id = ANY($1::uuid[])`, [jobIds]).catch(() => none),
    query(`SELECT user_id, full_name FROM user_profiles WHERE user_id = ANY($1::uuid[])`, [userIds]).catch(() => none),
  ])
  const jobById = new Map(jobs.rows.map((j) => [j.id, j]))
  const nameById = new Map(people.rows.map((p) => [p.user_id, p.full_name]))
  return [...pairs.values()]
    .filter((p) => jobById.has(p.jobId) && !['hire', 'reject'].includes(p.interview?.decision))
    .map((p) => ({ ...p, job: jobById.get(p.jobId), name: nameById.get(p.userId), verdict: verdictFor(jobSteps(jobById.get(p.jobId), p.tests, p.interview)) }))
    .filter((p) => p.verdict.key === 'recommended' || p.verdict.key === 'consider')
    .sort((a, b) => (a.verdict.key === b.verdict.key ? 0 : a.verdict.key === 'recommended' ? -1 : 1))
    .slice(0, 6)
}

// Sign-ups, finished tests and interviews per day, last 30 days.
async function fetchActivity() {
  const { rows } = await query(`
    SELECT day::text AS day, kind, COUNT(*)::int AS n FROM (
      SELECT created_at::date AS day, 'signups' AS kind FROM user_profiles
        WHERE COALESCE(account_type, 'candidate') = 'candidate' AND created_at >= current_date - 29
      UNION ALL SELECT completed_at::date, 'tests' FROM assessment_sessions
        WHERE form IS NOT NULL AND completed_at >= current_date - 29
      UNION ALL SELECT created_at::date, 'interviews' FROM interview_candidates WHERE created_at >= current_date - 29
      UNION ALL SELECT created_at::date, 'interviews' FROM expert_assessments WHERE created_at >= current_date - 29
    ) x GROUP BY 1, 2
  `).catch(() => none)
  const days = []
  const today = new Date()
  for (let i = 29; i >= 0; i--) {
    const d = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() - i))
    days.push({ day: d.toISOString().slice(0, 10), signups: 0, tests: 0, interviews: 0 })
  }
  const byDay = new Map(days.map((d) => [d.day, d]))
  for (const r of rows) { const d = byDay.get(r.day); if (d) d[r.kind] += r.n }
  return days
}

async function fetchRecent() {
  return (await query(`
    SELECT x.*, p.full_name FROM (
      (SELECT 'test' AS kind, s.completed_at AS at, s.candidate_user_id AS uid, s.track, s.role_family, j.title AS job
         FROM assessment_sessions s LEFT JOIN interview_jobs j ON j.id = s.job_id
         WHERE s.form IS NOT NULL AND s.completed_at IS NOT NULL ORDER BY s.completed_at DESC LIMIT 8)
      UNION ALL
      (SELECT 'interview', ic.created_at, ic.user_id, NULL, NULL, j.title
         FROM interview_candidates ic LEFT JOIN interview_jobs j ON j.id = ic.job_id ORDER BY ic.created_at DESC LIMIT 8)
      UNION ALL
      (SELECT 'expert', created_at, candidate_user_id, NULL, NULL, domain FROM expert_assessments ORDER BY created_at DESC LIMIT 8)
      UNION ALL
      (SELECT 'signup', created_at, user_id, NULL, NULL, NULL FROM user_profiles
         WHERE COALESCE(account_type, 'candidate') = 'candidate' ORDER BY created_at DESC LIMIT 8)
    ) x
    LEFT JOIN user_profiles p ON p.user_id = x.uid
    ORDER BY x.at DESC LIMIT 8
  `).catch(() => none)).rows
}

const fmt = (d) => new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
const who = (name) => name || 'A candidate'
const profile = (uid) => (uid ? `/admin/candidates/${uid}` : null)
// "Customer service test", "English test" (that label already says test).
const testName = (row) => { const l = trackLabel(sessionTrack(row)); return /test$/i.test(l) ? l : `${l} test` }

function NumberCard({ label, value, sub, href }) {
  const inner = (
    <div className="h-full rounded-2xl border border-slate-200 bg-white p-5 transition hover:border-slate-300">
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className="mt-2 text-[30px] font-semibold leading-none tracking-tight text-slate-900 tabular-nums">{value ?? 0}</p>
      <p className="mt-2 min-h-[16px] text-xs text-slate-500">{sub || ' '}</p>
    </div>
  )
  return href ? <Link href={href} className="block">{inner}</Link> : inner
}

const TONE = {
  good: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  warn: 'bg-amber-50 text-amber-700 border-amber-200',
  bad: 'bg-red-50 text-red-700 border-red-200',
  info: 'bg-indigo-50 text-indigo-700 border-indigo-200',
}

// One thing that needs the admin: a coloured tag, a line, and where to go.
function Todo({ tone, tag, title, detail, href }) {
  const body = (
    <div className="flex items-start gap-3 px-5 py-3.5">
      <span className={`mt-0.5 shrink-0 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${TONE[tone]}`}>{tag}</span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-slate-900">{title}</p>
        {detail && <p className="mt-0.5 text-xs text-slate-500">{detail}</p>}
      </div>
      {href && <span aria-hidden="true" className="shrink-0 text-sm text-indigo-600">→</span>}
    </div>
  )
  return <li>{href ? <Link href={href} className="block hover:bg-slate-50">{body}</Link> : body}</li>
}

function recentLine(r) {
  if (r.kind === 'test') return `${who(r.full_name)} finished the ${testName(r)}${r.job ? ` for ${r.job}` : ''}`
  if (r.kind === 'interview') return `${who(r.full_name)} did the AI interview${r.job ? ` for ${r.job}` : ''}`
  if (r.kind === 'expert') return `${who(r.full_name)} did an expert interview${r.job ? ` (${r.job})` : ''}`
  return `${who(r.full_name)} signed up`
}

export default async function AdminHome() {
  const [n, stuck, integrity, ready, activity, recent] = await Promise.all([
    fetchNumbers(), fetchStuck(), fetchIntegrity(), fetchReadyToDecide(), fetchActivity(), fetchRecent(),
  ])
  // A "Consider" row already covers integrity notes on that person's job.
  const listed = new Set(ready.map((p) => `${p.jobId}:${p.userId}`))
  const notes = integrity.filter((t) => !listed.has(`${t.job_id}:${t.candidate_user_id}`))
  const nothingToDo = !n.new_enquiries && stuck.length === 0 && notes.length === 0 && ready.length === 0

  return (
    <div className="max-w-6xl space-y-8">
      <div>
        <h1 className="text-[28px] font-semibold tracking-tight text-slate-900">Home</h1>
        <p className="mt-1.5 text-slate-500">What needs you today, and how the site is doing.</p>
      </div>

      <section>
        <h2 className="mb-3 text-sm font-semibold text-slate-900">Needs your attention</h2>
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          {nothingToDo ? (
            <p className="px-5 py-8 text-center text-sm text-slate-500">Nothing needs you right now.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {n.new_enquiries > 0 && (
                <Todo tone="info" tag="Enquiry" href="/admin/companies"
                  title={`${n.new_enquiries} new compan${n.new_enquiries > 1 ? 'ies want' : 'y wants'} to hire through JobStream`}
                  detail="Contact them, then give them company access on the Companies page." />
              )}
              {ready.map((p) => (
                <Todo key={`${p.jobId}:${p.userId}`} tone={p.verdict.tone} tag={p.verdict.label} href={profile(p.userId)}
                  title={`${who(p.name)} finished every step for ${p.job.title}`}
                  detail={p.verdict.key === 'recommended' ? 'Clears the bar on every step. Ready for a hire or reject decision.' : `Worth a closer look: ${p.verdict.reasons.join(', ')}.`} />
              ))}
              {notes.map((t) => (
                <Todo key={t.id} tone="warn" tag="Check" href={profile(t.candidate_user_id)}
                  title={`${who(t.full_name)}: integrity notes on the ${testName(t)}${t.job_title ? ` for ${t.job_title}` : ''}`}
                  detail={(t.integrity?.notes || [])[0]} />
              ))}
              {stuck.map((t) => (
                <Todo key={t.id} tone="bad" tag="Not marked" href={profile(t.candidate_user_id)}
                  title={`${who(t.full_name)}'s ${testName(t)} has no result yet`}
                  detail={`Finished ${fmt(t.completed_at)}. Marking failed or is stuck, usually because the AI marking service was busy or out of free quota.`} />
              ))}
            </ul>
          )}
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold text-slate-900">Numbers</h2>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
          <NumberCard label="Candidates" value={n.candidates} sub={`${n.candidates_7d || 0} new this week`} href="/admin/candidates" />
          <NumberCard label="Open jobs" value={n.open_jobs} sub="on the jobs page" href="/company/jobs" />
          <NumberCard label="Tests finished" value={n.tests} sub={`${n.tests_7d || 0} this week`} />
          <NumberCard label="Interviews" value={(n.job_interviews || 0) + (n.expert_interviews || 0)} sub={`${n.job_interviews || 0} job, ${n.expert_interviews || 0} expert`} href="/admin/interviews" />
          <NumberCard label="Companies" value={n.companies} sub={n.new_enquiries ? `${n.new_enquiries} new enquir${n.new_enquiries > 1 ? 'ies' : 'y'}` : 'invite only'} href="/admin/companies" />
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6">
        <h2 className="text-sm font-semibold text-slate-900">Last 30 days</h2>
        <p className="mt-1 text-xs text-slate-500">Sign-ups, finished tests and interviews each day.</p>
        <div className="mt-4"><ActivityChart data={activity} /></div>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold text-slate-900">Latest activity</h2>
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          {recent.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-slate-500">Nothing yet.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {recent.map((r, i) => {
                const href = profile(r.uid)
                const row = (
                  <div className="flex items-center justify-between gap-4 px-5 py-3 text-sm">
                    <span className="min-w-0 text-slate-800">{recentLine(r)}</span>
                    <span className="shrink-0 text-xs text-slate-500 tabular-nums">{fmt(r.at)}</span>
                  </div>
                )
                return <li key={i}>{href ? <Link href={href} className="block hover:bg-slate-50">{row}</Link> : row}</li>
              })}
            </ul>
          )}
        </div>
      </section>
    </div>
  )
}
