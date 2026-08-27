'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'

const PER_PAGE = 12

// Compensation shown on the card. Roles are a mix of hourly contracts,
// fixed-price engagements and annual salaries, so the unit has to be explicit —
// "$60" means very different things across those three.
const compact = (n) => (n >= 1000 ? `$${Math.round(n / 1000)}k` : `$${n}`)
function formatPay(job) {
  const { pay_type: type, pay_min: min, pay_max: max } = job || {}
  if (!type || min == null) return null
  if (type === 'hourly') return max && max !== min ? `$${min}–$${max}/hr` : `$${min}/hr`
  if (type === 'fixed') return `${compact(min)} fixed price`
  return max && max !== min ? `${compact(min)}–${compact(max)}/yr` : `${compact(min)}/yr`
}

export default function DashboardJobsBoard({ jobs = [], hasResume = false, doneJobIds = [] }) {
  const [tab, setTab] = useState('jobs')          // 'jobs' | 'assessments'
  const [q, setQ] = useState('')
  const [sort, setSort] = useState('all')         // 'all' | 'newest'
  const [domain, setDomain] = useState('')        // role filter
  const [page, setPage] = useState(1)

  const doneSet = useMemo(() => new Set(doneJobIds), [doneJobIds])
  const domains = useMemo(
    () => [...new Set(jobs.map((j) => j.role).filter(Boolean))].sort(),
    [jobs]
  )

  const filtered = useMemo(() => {
    let list = jobs
    if (q.trim()) {
      const s = q.toLowerCase()
      list = list.filter((j) => `${j.title} ${j.role || ''}`.toLowerCase().includes(s))
    }
    if (domain) list = list.filter((j) => j.role === domain)
    if (sort === 'newest') {
      list = [...list].sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    }
    return list
  }, [jobs, q, domain, sort])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PER_PAGE))
  const clampedPage = Math.min(page, totalPages)
  const pageJobs = filtered.slice((clampedPage - 1) * PER_PAGE, clampedPage * PER_PAGE)

  function reset(setter) {
    return (v) => { setter(v); setPage(1) }
  }

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header + Jobs/Assessments toggle */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <h1 className="text-[28px] md:text-3xl font-semibold tracking-tight text-slate-900">Apply to Jobs</h1>
        <div className="inline-flex items-center gap-1 p-1 rounded-full bg-slate-100">
          {[['jobs', 'Jobs'], ['assessments', 'Assessments']].map(([key, label]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition ${
                tab === key ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {!hasResume && tab === 'jobs' && (
        <Link
          href="/dashboard/profile?tab=resume"
          className="flex items-center justify-between gap-4 px-5 py-3.5 mb-6 rounded-2xl border border-amber-200 bg-amber-50/70 hover:bg-amber-50 transition"
        >
          <p className="text-sm text-amber-800 font-medium">Upload your resume before starting an interview.</p>
          <span className="text-sm font-semibold text-amber-800 whitespace-nowrap">Upload →</span>
        </Link>
      )}

      {tab === 'assessments' ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50/50 px-6 py-20 text-center">
          <p className="text-slate-500">Skill assessments are coming soon.</p>
          <p className="text-slate-400 text-sm mt-1">You'll be able to take role-based assessments right here.</p>
        </div>
      ) : (
        <>
          {/* Search + filters */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-6">
            <div className="relative flex-1">
              <svg className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><path d="M21 21l-4.3-4.3" /></svg>
              <input
                value={q}
                onChange={(e) => reset(setQ)(e.target.value)}
                placeholder="Search roles"
                className="w-full pl-11 pr-4 py-3 rounded-full border border-slate-200 bg-white focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 outline-none transition text-sm"
              />
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <div className="inline-flex items-center gap-1 p-1 rounded-full bg-slate-100">
                {[['all', 'All'], ['newest', 'Newest']].map(([key, label]) => (
                  <button
                    key={key}
                    onClick={() => reset(setSort)(key)}
                    className={`px-3.5 py-1.5 rounded-full text-sm font-medium transition ${
                      sort === key ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              {domains.length > 0 && (
                <select
                  value={domain}
                  onChange={(e) => reset(setDomain)(e.target.value)}
                  className="px-4 py-2 rounded-full border border-slate-200 bg-white text-sm text-slate-600 focus:border-indigo-400 outline-none cursor-pointer"
                >
                  <option value="">Domain</option>
                  {domains.map((d) => <option key={d} value={d}>{d}</option>)}
                </select>
              )}
            </div>
          </div>

          {/* Cards */}
          {filtered.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50/50 px-6 py-16 text-center">
              <p className="text-slate-500">{jobs.length === 0 ? 'No open positions right now. Check back soon.' : 'No roles match your search.'}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {pageJobs.map((job) => {
                const interviewed = doneSet.has(job.id)
                const href = interviewed || hasResume ? `/interview/${job.slug}` : '/dashboard/profile?tab=resume'
                return (
                  <Link
                    key={job.id}
                    href={href}
                    className="group flex flex-col h-full min-h-[168px] bg-white border border-slate-200/80 rounded-2xl p-5 hover:border-slate-300 hover:shadow-[0_1px_2px_rgba(15,23,42,0.04),0_12px_28px_-18px_rgba(15,23,42,0.25)] transition-all"
                  >
                    <h3 className="text-[15px] font-semibold text-slate-900 leading-snug group-hover:text-indigo-600 transition-colors line-clamp-2">
                      {job.title}
                    </h3>
                    {job.company && (
                      <p className="text-sm font-medium text-slate-600 mt-1 line-clamp-1">{job.company}</p>
                    )}
                    {formatPay(job) && (
                      <p className="text-[13px] font-semibold text-emerald-700 mt-1.5">{formatPay(job)}</p>
                    )}

                    <div className="mt-auto pt-4 flex items-center justify-between">
                      {interviewed ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700">
                          ✓ Interviewed
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-slate-400">
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z"/><path d="M19 10v1a7 7 0 0 1-14 0v-1"/></svg>
                          AI Interview
                        </span>
                      )}
                      <span className="text-slate-300 group-hover:text-indigo-500 group-hover:translate-x-0.5 transition">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6" /></svg>
                      </span>
                    </div>
                  </Link>
                )
              })}
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-1.5 mt-8">
              <PageBtn disabled={clampedPage === 1} onClick={() => setPage(clampedPage - 1)} aria="Previous">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
              </PageBtn>
              {pageNumbers(clampedPage, totalPages).map((p, i) =>
                p === '…' ? (
                  <span key={`e${i}`} className="px-2 text-slate-400">…</span>
                ) : (
                  <button
                    key={p}
                    onClick={() => setPage(p)}
                    className={`min-w-[36px] h-9 px-2 rounded-full text-sm font-medium transition ${
                      p === clampedPage ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    {p}
                  </button>
                )
              )}
              <PageBtn disabled={clampedPage === totalPages} onClick={() => setPage(clampedPage + 1)} aria="Next">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6" /></svg>
              </PageBtn>
            </div>
          )}
        </>
      )}
    </div>
  )
}

function PageBtn({ children, disabled, onClick, aria }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={aria}
      className="w-9 h-9 rounded-full flex items-center justify-center text-slate-500 hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent transition"
    >
      {children}
    </button>
  )
}

// Compact page list: 1 … around-current … last
function pageNumbers(current, total) {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)
  const out = [1]
  const start = Math.max(2, current - 1)
  const end = Math.min(total - 1, current + 1)
  if (start > 2) out.push('…')
  for (let p = start; p <= end; p++) out.push(p)
  if (end < total - 1) out.push('…')
  out.push(total)
  return out
}
