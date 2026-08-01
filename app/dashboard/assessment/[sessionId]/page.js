'use client'

// Optional standalone results viewer — reads GET /api/assessment/[id] directly
// so a completed session's results can be reloaded/shared via a stable URL
// without re-running the assessment. The primary candidate flow is the
// single-page state machine at app/assessment/page.js; this page is a
// read-only companion for the 'complete' phase.

import { useEffect, useState } from 'react'

function friendlyError(err) {
  const msg = err?.message || String(err)
  if (msg.includes('404') || msg.includes('not found')) {
    return "We couldn't find that assessment session."
  }
  if (msg.includes('fetch') || msg.includes('network') || msg.includes('Failed to fetch')) {
    return 'Connection error. Check your internet and try again.'
  }
  return 'Something went wrong loading these results.'
}

export default function AssessmentResultsPage({ params }) {
  const { sessionId } = params
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [data, setData] = useState(null)

  useEffect(() => {
    if (!sessionId) return
    let cancelled = false
    async function load() {
      setLoading(true)
      setError('')
      try {
        const res = await fetch(`/api/assessment/${sessionId}`)
        if (!res.ok) {
          const body = await res.json().catch(() => ({}))
          throw new Error(body.error || `Request failed (${res.status})`)
        }
        const json = await res.json()
        if (!cancelled) setData(json)
      } catch (err) {
        if (!cancelled) setError(friendlyError(err))
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [sessionId])

  return (
    <div className="pb-10">
      <div className="container mx-auto max-w-3xl">
        <div className="mb-8 text-center">
          <span className="inline-block px-4 py-1.5 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-600 font-black text-[10px] uppercase tracking-[0.4em] mb-4">
            Assessment Results
          </span>
          <h1 className="text-3xl md:text-5xl font-black tracking-tight uppercase text-slate-900">
            Session
          </h1>
        </div>

        <div className="bg-white border border-slate-200 rounded-[2.5rem] p-8 md:p-12 shadow-xl shadow-indigo-500/5">
          {loading && <p className="text-slate-500 text-center animate-pulse">Loading results…</p>}

          {!loading && error && (
            <div className="p-4 rounded-2xl border border-red-200 bg-red-50 text-red-600 text-sm text-center">
              {error}
            </div>
          )}

          {!loading && !error && data && (
            <div className="space-y-8">
              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-2xl border border-slate-200 p-5">
                  <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">State</p>
                  <p className="text-slate-900 font-black mt-2 text-sm uppercase">{data.session?.state || '—'}</p>
                </div>
                <div className="rounded-2xl border border-slate-200 p-5">
                  <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">Role</p>
                  <p className="text-slate-900 font-black mt-2 text-sm">
                    {data.session?.role_family} · {data.session?.seniority_band}
                  </p>
                </div>
              </div>

              {data.report ? (
                <div>
                  <h3 className="text-xs font-black uppercase tracking-[0.3em] text-slate-500 mb-2">Report</h3>
                  <p className="text-slate-800 leading-relaxed">{data.report.summary}</p>
                </div>
              ) : (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-center">
                  <p className="text-amber-600 text-xs font-black uppercase tracking-[0.3em] mb-1">Full report pending</p>
                  <p className="text-slate-700 text-sm">Responses are recorded below.</p>
                </div>
              )}

              {Array.isArray(data.responses) && data.responses.length > 0 && (
                <div>
                  <h3 className="text-xs font-black uppercase tracking-[0.3em] text-slate-500 mb-3">Responses</h3>
                  <div className="grid gap-2">
                    {data.responses.map((r) => (
                      <div
                        key={r.id}
                        className="flex items-center justify-between px-4 py-3 rounded-xl border border-slate-200 text-sm"
                      >
                        <span className="text-slate-700 truncate pr-4">
                          {r.seq}. {(r.prompt || '').slice(0, 70)}{(r.prompt || '').length > 70 ? '…' : ''}
                        </span>
                        <span className="text-indigo-600 font-black flex-shrink-0">
                          {r.score != null ? r.score : 'Scored by AI · pending'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {Array.isArray(data.currentSkillGraph) && data.currentSkillGraph.length > 0 && (
                <div>
                  <h3 className="text-xs font-black uppercase tracking-[0.3em] text-slate-500 mb-3">Skill Graph</h3>
                  <div className="grid gap-2">
                    {data.currentSkillGraph.map((s) => (
                      <div
                        key={s.skill_code}
                        className="flex items-center justify-between px-4 py-3 rounded-xl border border-slate-200 text-sm"
                      >
                        <span className="text-slate-800 font-bold">{s.skill_code}</span>
                        <span className="text-slate-500">
                          θ {s.theta != null ? Number(s.theta).toFixed(2) : '—'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
