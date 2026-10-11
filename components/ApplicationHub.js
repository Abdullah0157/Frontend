'use client'

import { useState } from 'react'
import Link from 'next/link'

// Candidate application hub — Mercor-style. Shows the job, an application
// progress bar, and a checklist of steps (resume, expert interview, skills
// assessments, AI interview) each with a completion state. Account-level steps
// (resume, expert interview) are reused across every role.
export default function ApplicationHub({ job, steps, doneCount, allComplete, application }) {
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [submitted, setSubmitted] = useState(application?.status === 'submitted')

  const total = steps.length
  const nextStep = steps.find((st) => !st.done)
  const pct = total ? Math.round((doneCount / total) * 100) : 0

  async function submitApplication() {
    setError('')
    setSubmitting(true)
    try {
      const res = await fetch('/api/applications/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId: job.id }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Could not submit')
      setSubmitted(true)
    } catch (e) {
      setError(e.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen pt-28 pb-24 px-4">
      <div className="container mx-auto max-w-2xl">
        {/* Job header */}
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-ink mb-2">{job.title}</h1>
        <div className="flex items-center gap-2 text-sm text-muted mb-8 flex-wrap">
          <span className="inline-flex items-center gap-1.5">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/></svg>
            {job.role}
          </span>
          <span className="text-slate-300">·</span>
          <span className="inline-flex items-center gap-1.5">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 12-9 12s-9-5-9-12a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
            Remote
          </span>
          {job.company && <><span className="text-slate-300">·</span><span>{job.company}</span></>}
        </div>

        {submitted ? (
          <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-10 text-center">
            <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-emerald-500/20 flex items-center justify-center">
              <svg className="w-7 h-7 text-emerald-700" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
            </div>
            <h2 className="text-2xl font-bold text-ink mb-2">Application Submitted</h2>
            <p className="text-body text-sm max-w-sm mx-auto">
              Your steps have been sent to the hiring team. You'll hear back if there's a match.
            </p>
            <Link href="/jobs" className="inline-block mt-6 text-sm font-semibold px-6 py-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-body transition">
              Browse more jobs
            </Link>
          </div>
        ) : (
          <div className="bg-white border border-line rounded-2xl p-6 md:p-8">
            {/* Application progress */}
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-lg font-bold text-ink">Application</h2>
              <span className="text-sm font-semibold text-muted">{pct}%</span>
            </div>
            <p className="text-sm text-muted mb-3">{doneCount} of {total} steps completed</p>
            <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden mb-8">
              <div className="h-full bg-brand rounded-full transition-all" style={{ width: `${pct}%` }} />
            </div>

            {error && (
              <div className="mb-6 p-4 rounded-xl border border-red-200 bg-red-50 text-red-600 text-sm">{error}</div>
            )}

            {/* Steps checklist */}
            <div className="divide-y divide-slate-100">
              {steps.map((s) => (
                <Link
                  key={s.key}
                  href={s.href}
                  className="group flex items-center gap-4 py-4 -mx-2 px-2 rounded-xl hover:bg-slate-50 transition"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-ink">{s.label}</span>
                      {s.core && (
                        <span className="text-xs font-bold px-1.5 py-0.5 rounded bg-slate-100 text-muted border border-line">Core</span>
                      )}
                      {s.reused && (
                        <span className="text-xs font-bold px-1.5 py-0.5 rounded bg-indigo-50 text-brand border border-indigo-100">Reused</span>
                      )}
                    </div>
                    <p className={`text-sm mt-0.5 ${s.done ? 'text-muted' : 'text-muted'}`}>
                      {s.done ? s.statusDone : s.statusTodo}
                    </p>
                  </div>
                  {/* Check circle */}
                  {s.done ? (
                    <span className="w-6 h-6 rounded-full bg-brand flex items-center justify-center flex-shrink-0">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M5 13l4 4L19 7"/></svg>
                    </span>
                  ) : (
                    <span className="w-6 h-6 rounded-full border-2 border-slate-300 group-hover:border-indigo-400 flex items-center justify-center flex-shrink-0 transition-colors">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-slate-300 group-hover:text-indigo-400 transition-colors"><path d="M9 18l6-6-6-6"/></svg>
                    </span>
                  )}
                </Link>
              ))}
            </div>

            <p className="text-xs text-muted mt-6 flex items-start gap-2">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="flex-shrink-0 mt-0.5"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>
              <span>Steps marked <span className="font-semibold text-brand">Reused</span> are shared across every role — do them once and you never repeat them.</span>
            </p>

            {/* Main action: the next unfinished step, then submit once all are done.
                (It used to be a greyed-out "Continue application" button that
                did nothing until every step was complete.) */}
            {allComplete ? (
              <button
                onClick={submitApplication}
                disabled={submitting}
                className="mt-6 w-full py-3.5 rounded-xl bg-brand hover:bg-brand-dark text-white text-sm font-bold disabled:opacity-60 disabled:cursor-not-allowed transition"
              >
                {submitting ? 'Submitting…' : 'Submit application'}
              </button>
            ) : nextStep ? (
              <Link
                href={nextStep.href}
                className="mt-6 block w-full py-3.5 rounded-xl bg-brand hover:bg-brand-dark text-white text-sm font-bold text-center transition"
              >
                Next: {nextStep.label} · {total - doneCount} step{total - doneCount !== 1 ? 's' : ''} left
              </Link>
            ) : null}
          </div>
        )}
      </div>
    </div>
  )
}
