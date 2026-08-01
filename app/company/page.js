'use client'

import { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'

function fitColor(score) {
  if (score == null) return 'text-slate-400'
  if (score >= 80) return 'text-emerald-600'
  if (score >= 60) return 'text-indigo-600'
  if (score >= 40) return 'text-amber-600'
  return 'text-red-600'
}

function StatCard({ label, value, sub, icon, tint = 'indigo' }) {
  const tints = {
    indigo: 'bg-indigo-50 text-indigo-600 border-indigo-200',
    emerald: 'bg-emerald-50 text-emerald-600 border-emerald-200',
    amber: 'bg-amber-50 text-amber-600 border-amber-200',
    red: 'bg-red-50 text-red-600 border-red-200',
  }
  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-6 hover:border-slate-300 transition shadow-sm">
      <div className="flex items-start justify-between mb-4">
        <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500">{label}</p>
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center border ${tints[tint]}`}>
          {icon}
        </div>
      </div>
      <p className="text-4xl font-black text-slate-900 tracking-tight">{value}</p>
      {sub && <p className="text-xs text-slate-400 mt-2">{sub}</p>}
    </div>
  )
}

function Sparkline({ data }) {
  // Simple inline SVG bar chart of last 14 days of candidate activity.
  if (!data || data.length === 0) return <p className="text-slate-400 text-xs">No activity in the last 30 days.</p>
  const days = []
  const today = new Date()
  for (let i = 13; i >= 0; i--) {
    const d = new Date(today)
    d.setDate(today.getDate() - i)
    const dayStr = d.toISOString().slice(0, 10)
    const hit = data.find((row) => String(row.day).slice(0, 10) === dayStr)
    days.push({ day: dayStr, n: hit ? hit.n : 0 })
  }
  const max = Math.max(...days.map((d) => d.n), 1)
  return (
    <div className="flex items-end gap-2 h-32">
      {days.map((d) => {
        const h = (d.n / max) * 100
        return (
          <div key={d.day} className="flex-1 flex flex-col items-center group">
            <div
              className="w-full bg-gradient-to-t from-indigo-500/40 to-indigo-500 rounded-t-md transition-all group-hover:from-indigo-500/60"
              style={{ height: `${Math.max(h, 4)}%` }}
              title={`${d.day}: ${d.n}`}
            />
            <span className="text-[8px] text-slate-400 mt-1 font-mono">
              {new Date(d.day).getDate()}
            </span>
          </div>
        )
      })}
    </div>
  )
}

function DecisionBadge({ decision }) {
  if (decision === 'hire')
    return <span className="text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-200">Hired</span>
  if (decision === 'reject')
    return <span className="text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full bg-red-50 text-red-600 border border-red-200">Rejected</span>
  return <span className="text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full bg-slate-100 text-slate-700 border border-slate-300">Pending</span>
}

function CompanyDashboardInner() {
  const router = useRouter()
  const params = useSearchParams()
  const onboarding = params.get('onboarding') === '1'

  const [data, setData] = useState({ stats: {}, topJobs: [], recentCandidates: [], activity: [] })
  const [companyName, setCompanyName] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    Promise.all([
      fetch('/api/company/stats', { cache: 'no-store' }),
      fetch('/api/me', { cache: 'no-store' }),
    ])
      .then(async ([sRes, mRes]) => {
        if (sRes.status === 401) { router.push('/login/company'); return }
        if (sRes.status === 403) {
          setError('This page is for company accounts. Sign up at /signup/company.')
          return
        }
        if (sRes.ok) setData(await sRes.json())
        if (mRes.ok) {
          const m = await mRes.json()
          setCompanyName(m.companyName || '')
        }
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [router])

  const s = data.stats || {}

  return (
    <div className="px-8 py-10">
      {/* Top header */}
      <div className="flex items-end justify-between mb-10">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.4em] text-indigo-600 mb-2">Dashboard</p>
          <h1 className="text-3xl md:text-4xl font-black text-slate-900">
            Welcome back{companyName ? `, ${companyName}` : ''}
          </h1>
        </div>
        <Link
          href="/company/jobs"
          className="text-xs font-black uppercase tracking-widest px-5 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-500/30 transition"
        >
          + Create Job
        </Link>
      </div>

      {onboarding && (
        <div className="mb-8 p-5 rounded-2xl bg-gradient-to-r from-indigo-50 to-blue-50 border border-indigo-200">
          <p className="text-[10px] font-black uppercase tracking-[0.4em] text-indigo-600 mb-1">Welcome 👋</p>
          <p className="text-slate-900 text-sm">
            Your company is set up. Click "+ Create Job" above to post your first opening.
          </p>
        </div>
      )}

      {error && (
        <div className="mb-8 p-4 rounded-2xl border border-red-200 bg-red-50 text-red-600 text-sm">{error}</div>
      )}

      {/* Stats grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mb-10">
        <StatCard
          label="Active Jobs"
          value={s.active_jobs ?? '—'}
          sub={s.active_jobs > 0 ? `${s.active_jobs} role${s.active_jobs === 1 ? '' : 's'} live` : 'No jobs yet'}
          tint="indigo"
          icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 8h.01" /></svg>}
        />
        <StatCard
          label="Total Candidates"
          value={s.total_candidates ?? '—'}
          sub={s.avg_fit_score != null ? `Avg fit ${s.avg_fit_score}%` : 'Awaiting interviews'}
          tint="emerald"
          icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a4 4 0 00-3-3.87M9 20H4v-2a3 3 0 015.356-1.857M17 16a4 4 0 10-8 0v4h8v-4z" /></svg>}
        />
        <StatCard
          label="Pending Decisions"
          value={s.pending_decisions ?? '—'}
          sub={s.pending_decisions > 0 ? 'Needs your review' : 'All caught up'}
          tint="amber"
          icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
        />
        <StatCard
          label="Hired"
          value={s.hired_count ?? '—'}
          sub={s.rejected_count > 0 ? `${s.rejected_count} rejected` : 'No rejections'}
          tint="emerald"
          icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
        />
      </div>

      {/* Activity sparkline */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 mb-8 shadow-sm">
        <div className="flex items-center justify-between mb-6">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-500 mb-1">Activity</p>
            <h2 className="text-xl font-black text-slate-900">Candidates per day (last 14 days)</h2>
          </div>
        </div>
        <Sparkline data={data.activity} />
      </div>

      {/* Two-column: Top jobs + Recent candidates */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Top jobs */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-xs font-black uppercase tracking-[0.4em] text-slate-500">Top Jobs</h2>
            <Link href="/company/jobs" className="text-[10px] font-black uppercase tracking-widest text-indigo-600 hover:text-indigo-500">View all →</Link>
          </div>
          {data.topJobs.length === 0 ? (
            <p className="text-slate-400 text-sm">No jobs yet. <Link href="/company/jobs" className="text-indigo-600 underline">Create one.</Link></p>
          ) : (
            <div className="space-y-3">
              {data.topJobs.map((j, i) => (
                <Link key={j.id} href={`/company/jobs/${j.id}`} className="flex items-center gap-4 p-3 rounded-xl hover:bg-slate-100 transition">
                  <span className="text-2xl font-black text-slate-300 w-8 text-center">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="font-black text-slate-900 text-sm truncate">{j.title}</p>
                    <p className="text-slate-400 text-xs">{j.role}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-black text-slate-700">{j.candidate_count} candidates</p>
                    <p className={`text-[10px] font-black ${fitColor(j.top_fit)}`}>
                      {j.top_fit != null ? `${j.top_fit}% top fit` : 'no interviews'}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Recent candidates */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-xs font-black uppercase tracking-[0.4em] text-slate-500">Recent Candidates</h2>
            <Link href="/company/candidates" className="text-[10px] font-black uppercase tracking-widest text-indigo-600 hover:text-indigo-500">View all →</Link>
          </div>
          {data.recentCandidates.length === 0 ? (
            <p className="text-slate-400 text-sm">No candidates yet. Share your job's interview link to start receiving applications.</p>
          ) : (
            <div className="space-y-3">
              {data.recentCandidates.map((c) => (
                <Link key={c.id} href={`/company/jobs/${c.job_id}`} className="flex items-center gap-4 p-3 rounded-xl hover:bg-slate-100 transition">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-indigo-700 flex items-center justify-center text-white font-black text-xs">
                    {(c.name || '?').split(/\s+/).map(s => s[0]).join('').slice(0, 2).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-black text-slate-900 text-sm truncate">{c.name || '(no name)'}</p>
                    <p className="text-slate-400 text-xs truncate">{c.job_title}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    {c.job_fit_score != null && (
                      <p className={`text-sm font-black ${fitColor(c.job_fit_score)}`}>{c.job_fit_score}%</p>
                    )}
                    <DecisionBadge decision={c.decision} />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default function CompanyDashboard() {
  return (
    <Suspense>
      <CompanyDashboardInner />
    </Suspense>
  )
}
