import Link from 'next/link'
import { query } from '@/lib/db'
import { InterviewsPerDayChart, UsersDonut, ScoreDistributionBar, DecisionsDonut } from './AdminCharts'

export const dynamic = 'force-dynamic'

async function fetchOverview() {
  const [stats, recent, byDay, byDecision, scoreDist, userMix] = await Promise.all([
    query(`
      SELECT
        (SELECT COUNT(*)::int FROM user_profiles WHERE account_type = 'company') AS companies,
        (SELECT COUNT(*)::int FROM user_profiles WHERE COALESCE(account_type,'candidate') = 'candidate') AS candidates,
        (SELECT COUNT(*)::int FROM user_profiles WHERE account_type = 'super_admin') AS admins,
        (SELECT COUNT(*)::int FROM interview_candidates) AS interviews,
        (SELECT COUNT(*)::int FROM interview_sessions WHERE status = 'in_progress') AS active,
        (SELECT COUNT(*)::int FROM interview_jobs WHERE is_active) AS jobs,
        (SELECT COUNT(*)::int FROM interview_candidates WHERE created_at >= now() - interval '7 days') AS interviews_7d
    `).catch(() => ({ rows: [{}] })),
    query(`
      SELECT ic.id, ic.name, ic.created_at, ic.job_fit_score, ic.decision,
             ij.title AS job_title, ij.company AS company_name
      FROM interview_candidates ic
      LEFT JOIN interview_jobs ij ON ic.job_id = ij.id
      ORDER BY ic.created_at DESC
      LIMIT 8
    `).catch(() => ({ rows: [] })),
    query(`
      SELECT date_trunc('day', created_at)::date AS day, COUNT(*)::int AS n
      FROM interview_candidates
      WHERE created_at >= now() - interval '14 days'
      GROUP BY 1 ORDER BY 1
    `).catch(() => ({ rows: [] })),
    query(`
      SELECT COALESCE(decision, 'pending') AS decision, COUNT(*)::int AS n
      FROM interview_candidates
      GROUP BY COALESCE(decision, 'pending')
    `).catch(() => ({ rows: [] })),
    query(`
      SELECT
        CASE
          WHEN job_fit_score >= 8 THEN '8-10 (Strong)'
          WHEN job_fit_score >= 6 THEN '6-7 (Maybe)'
          WHEN job_fit_score >= 4 THEN '4-5 (Below)'
          ELSE '1-3 (No)'
        END AS band,
        COUNT(*)::int AS count
      FROM interview_candidates
      WHERE job_fit_score IS NOT NULL
      GROUP BY 1
      ORDER BY MIN(job_fit_score) DESC
    `).catch(() => ({ rows: [] })),
    query(`
      SELECT COALESCE(account_type, 'candidate') AS type, COUNT(*)::int AS n
      FROM user_profiles
      GROUP BY 1
    `).catch(() => ({ rows: [] })),
  ])
  return {
    stats: stats.rows[0] || {},
    recent: recent.rows || [],
    byDay: byDay.rows || [],
    byDecision: byDecision.rows || [],
    scoreDist: scoreDist.rows || [],
    userMix: userMix.rows.map((r) => ({
      name: r.type === 'super_admin' ? 'Admins' : r.type === 'company' ? 'Companies' : 'Candidates',
      value: r.n,
    })),
  }
}

function StatCard({ label, value, sub, tint = 'indigo', href }) {
  const dots = {
    indigo:  'bg-indigo-500',
    emerald: 'bg-emerald-500',
    amber:   'bg-amber-500',
    red:     'bg-red-500',
    purple:  'bg-purple-500',
  }
  // Fixed layout: header row, value, sub row (always rendered — even when
  // empty, use a non-breaking space so alignment stays consistent across cards
  // with and without subtitles).
  const inner = (
    <div className="group bg-white rounded-2xl border border-slate-200/80 p-5 hover:border-slate-300 hover:shadow-[0_1px_2px_rgba(15,23,42,0.04),0_12px_28px_-18px_rgba(15,23,42,0.25)] transition-all h-32 flex flex-col justify-between">
      <div className="flex items-center gap-2">
        <span className={`w-1.5 h-1.5 rounded-full ${dots[tint]} opacity-60 group-hover:opacity-100 transition-opacity`} />
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">{label}</p>
      </div>
      <div>
        <p className="text-[32px] font-semibold text-slate-900 leading-none tracking-tight tabular-nums">{value}</p>
        <p className="text-xs text-slate-400 mt-2 min-h-[16px]">{sub || ' '}</p>
      </div>
    </div>
  )
  return href ? <Link href={href}>{inner}</Link> : inner
}

function ChartCard({ title, subtitle, children, href }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 p-6">
      <div className="flex items-start justify-between mb-5">
        <div>
          <h3 className="text-sm font-semibold text-slate-900 tracking-tight">{title}</h3>
          {subtitle && <p className="text-xs text-slate-400 mt-1">{subtitle}</p>}
        </div>
        {href && <Link href={href} className="text-xs font-medium text-indigo-600 hover:text-indigo-700">View →</Link>}
      </div>
      {children}
    </div>
  )
}

export default async function AdminOverviewPage() {
  const { stats, recent, byDay, byDecision, scoreDist, userMix } = await fetchOverview()

  // Attach colors to score dist bars.
  const scoreDistColored = scoreDist.map((d) => ({
    ...d,
    color: d.band.startsWith('8')  ? '#10b981'
         : d.band.startsWith('6')  ? '#f59e0b'
         : d.band.startsWith('4')  ? '#f97316'
         : '#ef4444',
  }))

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-[28px] font-semibold text-slate-900 tracking-tight">Platform Overview</h1>
        <p className="text-slate-500 mt-1.5">Real-time view across every company, candidate, and interview on JobStream.</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <StatCard label="Companies" value={stats.companies ?? 0} tint="emerald" href="/admin/companies" />
        <StatCard label="Candidates" value={stats.candidates ?? 0} tint="indigo" href="/admin/candidates" />
        <StatCard label="Admins" value={stats.admins ?? 0} tint="purple" />
        <StatCard label="Interviews" value={stats.interviews ?? 0} tint="indigo" href="/admin/interviews" />
        <StatCard label="Live Now" value={stats.active ?? 0} sub="in progress" tint="amber" />
        <StatCard label="Active Jobs" value={stats.jobs ?? 0} tint="emerald" />
      </div>

      {/* Charts row 1 — mix + growth */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <ChartCard title="User Mix" subtitle="Hover slices for exact counts">
          <UsersDonut data={userMix} />
        </ChartCard>
        <ChartCard title="Decisions" subtitle="Hire outcomes across all interviews">
          <DecisionsDonut data={byDecision} />
        </ChartCard>
        <ChartCard title="Score Distribution" subtitle="Interview scores by band" href="/admin/analytics">
          <ScoreDistributionBar data={scoreDistColored} />
        </ChartCard>
      </div>

      {/* Charts row 2 — interview volume */}
      <ChartCard title="Interview Volume" subtitle={`${stats.interviews_7d ?? 0} interviews in the last 7 days · 14-day trend below`} href="/admin/analytics">
        <InterviewsPerDayChart data={byDay} />
      </ChartCard>

      {/* Recent interviews */}
      <div className="bg-white rounded-2xl border border-slate-200/80">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-900 tracking-tight">Recent Interviews</h2>
          <Link href="/admin/interviews" className="text-xs font-medium text-indigo-600 hover:text-indigo-700">View all →</Link>
        </div>
        {recent.length === 0 ? (
          <p className="px-6 py-10 text-center text-slate-500 text-sm">No interviews yet.</p>
        ) : (
          <div className="divide-y divide-slate-100">
            {recent.map((r) => (
              <div key={r.id} className="px-6 py-4 flex items-center justify-between hover:bg-slate-50 transition-colors">
                <div>
                  <p className="text-sm font-medium text-slate-900">{r.name}</p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {r.job_title || 'Untitled role'}
                    {r.company_name && ` · ${r.company_name}`}
                  </p>
                </div>
                <div className="flex items-center gap-4">
                  {r.job_fit_score != null && (
                    <span className="text-sm font-medium text-slate-700 tabular-nums">{r.job_fit_score}<span className="text-slate-400">/10</span></span>
                  )}
                  <span className={`text-[11px] font-medium capitalize px-2.5 py-1 rounded-full ${
                    r.decision === 'accepted' ? 'bg-emerald-50 text-emerald-700' :
                    r.decision === 'rejected' ? 'bg-red-50 text-red-700' :
                    'bg-slate-100 text-slate-600'
                  }`}>
                    {r.decision || 'pending'}
                  </span>
                  <span className="text-xs text-slate-400 tabular-nums">{new Date(r.created_at).toLocaleDateString()}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
