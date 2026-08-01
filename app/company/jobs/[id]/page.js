'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import EieProfile from '@/components/EieProfile'

function fitColor(score) {
  if (score == null) return 'text-slate-400'
  if (score >= 80) return 'text-emerald-600'
  if (score >= 60) return 'text-indigo-600'
  if (score >= 40) return 'text-amber-600'
  return 'text-red-600'
}

function decisionBadge(decision) {
  if (decision === 'hire') return { label: 'Hired', cls: 'bg-emerald-50 text-emerald-600 border-emerald-200' }
  if (decision === 'reject') return { label: 'Rejected', cls: 'bg-red-50 text-red-600 border-red-200' }
  return { label: 'Pending', cls: 'bg-slate-100 text-slate-700 border-slate-300' }
}

export default function JobDashboard() {
  const { id } = useParams()
  const [data, setData] = useState({ job: null, candidates: [] })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [expanded, setExpanded] = useState(null)

  async function load() {
    setLoading(true)
    try {
      const res = await fetch(`/api/jobs/${id}`, { cache: 'no-store' })
      if (!res.ok) throw new Error('Failed to load job')
      const json = await res.json()
      setData(json)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  async function setDecision(candidateId, decision) {
    // Optimistic update
    setData((d) => ({
      ...d,
      candidates: d.candidates.map((c) => (c.id === candidateId ? { ...c, decision } : c)),
    }))
    try {
      const res = await fetch(`/api/candidates/${candidateId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision }),
      })
      if (!res.ok) throw new Error('Failed to update')
    } catch (e) {
      setError(e.message)
      load()
    }
  }

  useEffect(() => { load() }, [id])

  function shareLink(slug) {
    if (typeof window === 'undefined') return ''
    return `${window.location.origin}/interview/${slug}`
  }

  if (loading) {
    return <div className="min-h-screen pt-32 px-4 text-center text-slate-400">Loading…</div>
  }

  if (error || !data.job) {
    return (
      <div className="min-h-screen pt-32 px-4 text-center">
        <p className="text-red-600">{error || 'Job not found'}</p>
        <Link href="/company" className="text-indigo-600 underline mt-4 inline-block">← Back to jobs</Link>
      </div>
    )
  }

  const { job, candidates } = data

  return (
    <div className="min-h-screen pt-32 pb-24 px-4">
      <div className="container mx-auto max-w-5xl">
        <Link href="/company" className="text-xs font-black uppercase tracking-widest text-indigo-600 hover:text-indigo-800">
          ← All Jobs
        </Link>

        <div className="mt-6 mb-10">
          <h1 className="text-3xl md:text-4xl font-black tracking-tight text-slate-900">{job.title}</h1>
          <p className="text-indigo-600 font-black uppercase tracking-widest text-xs mt-2">{job.role}</p>
          <div className="mt-5 flex flex-col md:flex-row gap-3 md:items-center">
            <button
              onClick={() => navigator.clipboard.writeText(shareLink(job.slug))}
              className="text-xs font-black uppercase tracking-widest px-4 py-3 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 transition self-start"
            >
              Copy Interview Link
            </button>
            <code className="text-xs text-slate-400 truncate">{shareLink(job.slug)}</code>
            <button
              onClick={load}
              className="text-xs font-black uppercase tracking-widest px-4 py-3 rounded-full bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 transition self-start"
            >
              ↻ Refresh
            </button>
          </div>
        </div>

        <div className="mb-6 bg-white border border-slate-200 rounded-[2rem] p-6 shadow-sm">
          <h3 className="text-xs font-black uppercase tracking-[0.3em] text-slate-500 mb-2">Job Description</h3>
          <p className="text-slate-700 whitespace-pre-wrap leading-relaxed text-sm">{job.description}</p>
        </div>

        <h2 className="text-xs font-black uppercase tracking-[0.4em] text-slate-500 mb-4">
          Candidates ({candidates.length}) — ranked by job fit
        </h2>

        {candidates.length === 0 ? (
          <p className="text-slate-400 text-sm">
            No candidates yet. Share the interview link above to start collecting submissions.
          </p>
        ) : (
          <div className="grid gap-4">
            {candidates.map((c, idx) => {
              const isOpen = expanded === c.id
              const badge = decisionBadge(c.decision)
              return (
                <div key={c.id} className="bg-white border border-slate-200 rounded-[2rem] shadow-sm hover:shadow-xl hover:shadow-indigo-500/5 transition-all">
                  <button
                    onClick={() => setExpanded(isOpen ? null : c.id)}
                    className="w-full text-left p-6 md:p-8 flex flex-col md:flex-row md:items-center md:justify-between gap-4"
                  >
                    <div className="flex items-center gap-6">
                      <div className="text-3xl font-black text-slate-300 w-10 text-center">{idx + 1}</div>
                      <div>
                        <div className="flex items-center gap-3">
                          <h3 className="text-lg font-black text-slate-900">{c.name}</h3>
                          <span className={`text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full border ${badge.cls}`}>
                            {badge.label}
                          </span>
                        </div>
                        {c.email && <p className="text-slate-400 text-sm">{c.email}</p>}
                        <p className="text-slate-400 text-xs mt-1">
                          {new Date(c.created_at).toLocaleString()}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-8 text-right">
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Job Fit</p>
                        <p className={`text-3xl font-black ${fitColor(c.job_fit_score)}`}>
                          {c.job_fit_score != null ? `${c.job_fit_score}%` : '—'}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Score</p>
                        <p className="text-2xl font-black text-slate-900">
                          {c.report?.score != null ? `${c.report.score}/10` : '—'}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Rec</p>
                        <p className="text-sm font-black uppercase text-slate-700">
                          {String(c.report?.recommendation || '—').replace('_', ' ')}
                        </p>
                      </div>
                    </div>
                  </button>

                  {isOpen && (
                    <div className="px-6 md:px-8 pb-8 border-t border-slate-200 pt-6 space-y-6">
                      {c.fit_reasoning && (
                        <div>
                          <h4 className="text-xs font-black uppercase tracking-[0.3em] text-indigo-600 mb-2">
                            Why this fit score
                          </h4>
                          <p className="text-slate-700 text-sm leading-relaxed">{c.fit_reasoning}</p>
                        </div>
                      )}
                      {c.report?.eie && (
                        <div>
                          <h4 className="text-xs font-black uppercase tracking-[0.3em] text-slate-500 mb-3">
                            Evaluation Intelligence Engine
                          </h4>
                          <EieProfile eie={c.report.eie} />
                        </div>
                      )}

                      {c.report?.summary && (
                        <div>
                          <h4 className="text-xs font-black uppercase tracking-[0.3em] text-slate-500 mb-2">Summary</h4>
                          <p className="text-slate-700 text-sm leading-relaxed">{c.report.summary}</p>
                        </div>
                      )}

                      {Array.isArray(c.report?.rubric) && c.report.rubric.length > 0 && (
                        <div>
                          <h4 className="text-xs font-black uppercase tracking-[0.3em] text-slate-500 mb-3">
                            Rubric — graded against the job description
                          </h4>
                          <div className="space-y-3">
                            {c.report.rubric.map((r, i) => {
                              const score = Number(r.score) || 0
                              const pct = Math.max(0, Math.min(100, (score / 5) * 100))
                              const barColor = score >= 4 ? 'bg-emerald-500' : score >= 3 ? 'bg-indigo-500' : score >= 2 ? 'bg-amber-500' : 'bg-red-500'
                              return (
                                <div key={i} className="border border-slate-200 rounded-2xl p-4">
                                  <div className="flex items-center justify-between mb-2">
                                    <p className="font-black text-slate-900 text-sm">{r.skill}</p>
                                    <p className="text-sm font-black text-slate-900">{score}/5</p>
                                  </div>
                                  <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden mb-2">
                                    <div className={`h-full ${barColor}`} style={{ width: `${pct}%` }} />
                                  </div>
                                  {r.evidence && <p className="text-xs text-slate-400 leading-relaxed">{r.evidence}</p>}
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      )}

                      <div className="grid md:grid-cols-2 gap-6">
                        {Array.isArray(c.report?.strengths) && c.report.strengths.length > 0 && (
                          <div>
                            <h4 className="text-xs font-black uppercase tracking-[0.3em] text-emerald-600 mb-2">Strengths</h4>
                            <ul className="list-disc pl-5 space-y-1 text-slate-700 text-sm">
                              {c.report.strengths.map((s, i) => <li key={i}>{s}</li>)}
                            </ul>
                          </div>
                        )}
                        {Array.isArray(c.report?.concerns) && c.report.concerns.length > 0 && (
                          <div>
                            <h4 className="text-xs font-black uppercase tracking-[0.3em] text-amber-600 mb-2">Concerns</h4>
                            <ul className="list-disc pl-5 space-y-1 text-slate-700 text-sm">
                              {c.report.concerns.map((x, i) => <li key={i}>{x}</li>)}
                            </ul>
                          </div>
                        )}
                      </div>
                      {c.report?.highlight_quote && (
                        <blockquote className="border-l-4 border-indigo-500 pl-4 italic text-slate-600 text-sm">
                          "{c.report.highlight_quote}"
                        </blockquote>
                      )}

                      <div className="pt-4 border-t border-slate-200 flex flex-wrap items-center gap-3">
                        <span className="text-xs font-black uppercase tracking-[0.3em] text-slate-400 mr-2">Decision</span>
                        <button
                          onClick={(e) => { e.stopPropagation(); setDecision(c.id, 'hire') }}
                          disabled={c.decision === 'hire'}
                          className="text-xs font-black uppercase tracking-widest px-5 py-3 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white transition disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          ✓ Hire
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); setDecision(c.id, 'reject') }}
                          disabled={c.decision === 'reject'}
                          className="text-xs font-black uppercase tracking-widest px-5 py-3 rounded-full bg-red-600 hover:bg-red-700 text-white transition disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          ✕ Reject
                        </button>
                        {c.decision !== 'pending' && (
                          <button
                            onClick={(e) => { e.stopPropagation(); setDecision(c.id, 'pending') }}
                            className="text-xs font-black uppercase tracking-widest px-5 py-3 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 transition"
                          >
                            Reset
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
