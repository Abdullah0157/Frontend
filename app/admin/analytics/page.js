import { query } from '@/lib/db'
import { InterviewsPerDayChart, DecisionsDonut, ScoreDistributionBar, GrowthStackedArea } from '../AdminCharts'

export const dynamic = 'force-dynamic'

async function fetchAnalytics() {
  const [growth, byDecision, scoreStats, byDay, growthByDay, byCompany] = await Promise.all([
    query(`
      SELECT
        (SELECT COUNT(*)::int FROM user_profiles WHERE account_type = 'company' AND created_at >= now() - interval '7 days') AS new_companies_7d,
        (SELECT COUNT(*)::int FROM user_profiles WHERE COALESCE(account_type,'candidate') = 'candidate' AND created_at >= now() - interval '7 days') AS new_candidates_7d,
        (SELECT COUNT(*)::int FROM interview_candidates WHERE created_at >= now() - interval '7 days') AS interviews_7d,
        (SELECT COUNT(*)::int FROM interview_candidates WHERE created_at >= now() - interval '30 days') AS interviews_30d
    `).catch(() => ({ rows: [{}] })),
    query(`
      SELECT COALESCE(decision, 'pending') AS decision, COUNT(*)::int AS n
      FROM interview_candidates GROUP BY 1
    `).catch(() => ({ rows: [] })),
    query(`
      SELECT ROUND(AVG(job_fit_score)::numeric, 2) AS avg_score,
             COUNT(*) FILTER (WHERE job_fit_score >= 8)::int AS strong_hires,
             COUNT(*) FILTER (WHERE job_fit_score BETWEEN 6 AND 7)::int AS maybes,
             COUNT(*) FILTER (WHERE job_fit_score <= 5)::int AS below_bar
      FROM interview_candidates WHERE job_fit_score IS NOT NULL
    `).catch(() => ({ rows: [{}] })),
    query(`
      SELECT date_trunc('day', created_at)::date AS day, COUNT(*)::int AS n
      FROM interview_candidates
      WHERE created_at >= now() - interval '30 days'
      GROUP BY 1 ORDER BY 1
    `).catch(() => ({ rows: [] })),
    query(`
      SELECT date_trunc('day', created_at)::date AS day,
        COUNT(*) FILTER (WHERE account_type = 'company')::int AS companies,
        COUNT(*) FILTER (WHERE COALESCE(account_type,'candidate') = 'candidate')::int AS candidates
      FROM user_profiles
      WHERE created_at >= now() - interval '30 days'
      GROUP BY 1 ORDER BY 1
    `).catch(() => ({ rows: [] })),
    query(`
      SELECT ij.company AS name, COUNT(ic.id)::int AS count
      FROM interview_jobs ij
      LEFT JOIN interview_candidates ic ON ic.job_id = ij.id
      WHERE ij.company IS NOT NULL
      GROUP BY ij.company
      ORDER BY count DESC
      LIMIT 8
    `).catch(() => ({ rows: [] })),
  ])
  return {
    growth: growth.rows[0] || {},
    byDecision: byDecision.rows || [],
    scoreStats: scoreStats.rows[0] || {},
    byDay: byDay.rows || [],
    growthByDay: growthByDay.rows || [],
    byCompany: byCompany.rows || [],
  }
}

function StatCard({ label, value, sub, tint = 'indigo' }) {
  const tints = {
    indigo: 'from-indigo-500 to-indigo-600',
    emerald: 'from-emerald-500 to-emerald-600',
    amber: 'from-amber-500 to-amber-600',
    red: 'from-red-500 to-red-600',
  }
  return (
    <div className="group bg-white rounded-2xl border border-slate-200 p-5 hover:border-slate-300 hover:shadow-lg transition-all h-32 flex flex-col justify-between">
      <div className="flex items-start justify-between">
        <p className="text-xs font-black uppercase tracking-widest text-slate-500">{label}</p>
        <div className={`w-2 h-2 rounded-full bg-gradient-to-br ${tints[tint]} opacity-70 group-hover:opacity-100 transition-opacity`} />
      </div>
      <div>
        <p className="text-3xl font-bold text-slate-900 leading-none">{value}</p>
        <p className="text-xs text-slate-500 mt-1.5 min-h-[16px]">{sub || ' '}</p>
      </div>
    </div>
  )
}

function ChartCard({ title, subtitle, children, className = '' }) {
  return (
    <div className={`bg-white rounded-2xl border border-slate-200 p-6 ${className}`}>
      <div className="mb-4">
        <h3 className="text-sm font-black uppercase tracking-widest text-slate-700">{title}</h3>
        {subtitle && <p className="text-xs text-slate-500 mt-1">{subtitle}</p>}
      </div>
      {children}
    </div>
  )
}

export default async function AdminAnalyticsPage() {
  const { growth, byDecision, scoreStats, byDay, growthByDay, byCompany } = await fetchAnalytics()

  const scoreDistData = [
    { band: 'Strong (8-10)', count: scoreStats.strong_hires ?? 0, color: '#10b981' },
    { band: 'Maybe (6-7)',   count: scoreStats.maybes ?? 0,       color: '#f59e0b' },
    { band: 'Below (≤5)',    count: scoreStats.below_bar ?? 0,    color: '#ef4444' },
  ]

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Platform Analytics</h1>
        <p className="text-slate-500 mt-1">Growth, decisions, and scoring across every interview. Hover charts for exact numbers.</p>
      </div>

      {/* Growth stats — last 7 days */}
      <div>
        <h2 className="text-xs font-black uppercase tracking-widest text-slate-500 mb-3">Growth · Last 7 Days</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard label="New Companies" value={growth.new_companies_7d ?? 0} sub="signed up this week" tint="emerald" />
          <StatCard label="New Candidates" value={growth.new_candidates_7d ?? 0} sub="signed up this week" tint="indigo" />
          <StatCard label="Interviews (7d)" value={growth.interviews_7d ?? 0} sub="completed this week" tint="amber" />
          <StatCard label="Interviews (30d)" value={growth.interviews_30d ?? 0} sub="completed this month" tint="indigo" />
        </div>
      </div>

      {/* Row 1 — decisions + score distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartCard title="Decision Breakdown" subtitle="Hover slices for counts">
          <DecisionsDonut data={byDecision} />
        </ChartCard>
        <ChartCard title="Score Distribution" subtitle={`Average score: ${scoreStats.avg_score ?? '—'}/10`}>
          <ScoreDistributionBar data={scoreDistData} />
        </ChartCard>
      </div>

      {/* Row 2 — interview volume over 30 days */}
      <ChartCard title="Interview Volume · 30 Days" subtitle="Daily interview count. Hover for exact numbers per day.">
        <InterviewsPerDayChart data={byDay} />
      </ChartCard>

      {/* Row 3 — user growth stacked */}
      <ChartCard title="User Growth · 30 Days" subtitle="Companies and candidates signing up per day, stacked.">
        <GrowthStackedArea data={growthByDay} />
      </ChartCard>

      {/* Row 4 — top companies by interview count */}
      {byCompany.length > 0 && (
        <ChartCard title="Top Companies by Interview Volume" subtitle="Which companies are running the most screens.">
          <div className="space-y-2 mt-2">
            {byCompany.map((c, i) => {
              const max = Math.max(...byCompany.map((x) => x.count))
              const pct = max > 0 ? (c.count / max) * 100 : 0
              return (
                <div key={i} className="group">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-sm font-medium text-slate-800 truncate max-w-[70%]">{c.name}</span>
                    <span className="text-sm font-mono font-semibold text-slate-900">{c.count}</span>
                  </div>
                  <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-indigo-500 to-indigo-600 group-hover:from-indigo-600 group-hover:to-indigo-700 transition-all rounded-full"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </ChartCard>
      )}
    </div>
  )
}
