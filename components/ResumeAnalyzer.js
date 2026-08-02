'use client'

import { useEffect, useRef, useState } from 'react'

// The steps shown while a resume is analyzed. Each ticks green as it completes;
// the current one shows a spinner. Completion is gated on the real parse finishing
// (phase → 'done'), so the bar reaches 100% exactly when the sections are ready.
const STEPS = [
  'Personal info',
  'Resume',
  'Summary',
  'Education',
  'Work experience',
  'Projects',
  'Skills',
  'Coding profiles',
  'Links',
]

export default function ResumeAnalyzer({ phase = 'idle', onClose, error = '' }) {
  // phase: 'idle' | 'analyzing' | 'done' | 'error'
  const [count, setCount] = useState(0) // completed steps
  const timerRef = useRef(null)

  useEffect(() => {
    if (phase === 'analyzing') {
      setCount(0)
      // Reveal steps progressively, but hold the last one until parsing finishes
      // so the checklist never claims "done" before the resume actually is.
      timerRef.current = setInterval(() => {
        setCount((c) => (c < STEPS.length - 1 ? c + 1 : c))
      }, 420)
      return () => clearInterval(timerRef.current)
    }
    if (phase === 'done') {
      clearInterval(timerRef.current)
      setCount(STEPS.length) // tick everything, hit 100%
      const t = setTimeout(() => onClose?.(), 1300)
      return () => clearTimeout(t)
    }
  }, [phase]) // eslint-disable-line react-hooks/exhaustive-deps

  if (phase === 'idle') return null

  const isDone = phase === 'done'
  const isError = phase === 'error'
  const pct = isDone ? 100 : isError ? Math.round((count / STEPS.length) * 100) : Math.min(96, Math.round((count / STEPS.length) * 100))

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="px-7 pt-7 pb-5">
          <div className="flex items-center gap-3">
            {isError ? (
              <span className="w-9 h-9 rounded-full bg-red-50 border border-red-200 flex items-center justify-center">
                <svg className="w-5 h-5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}><path strokeLinecap="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </span>
            ) : isDone ? (
              <span className="w-9 h-9 rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center">
                <svg className="w-5 h-5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.4}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
              </span>
            ) : (
              <span className="w-9 h-9 rounded-full border-2 border-indigo-200 border-t-indigo-600 animate-spin" />
            )}
            <div>
              <p className="text-base font-bold text-slate-900">
                {isError ? 'Could not read your resume' : isDone ? 'Analysis complete' : 'Analyzing resume…'}
              </p>
              <p className="text-xs text-slate-400">
                {isError ? (error || 'Please try a different file.') : isDone ? 'All set — review the details below.' : 'Extracting the details from your resume.'}
              </p>
            </div>
          </div>

          {/* Progress */}
          {!isError && (
            <div className="mt-5">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[11px] font-bold uppercase tracking-widest text-slate-400">Progress</span>
                <span className="text-sm font-black tabular-nums text-indigo-600">{pct}%</span>
              </div>
              <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-indigo-600 transition-[width] duration-500 ease-out"
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Checklist */}
        {!isError && (
          <div className="px-7 pb-7 max-h-[46vh] overflow-y-auto">
            <ul className="space-y-1.5">
              {STEPS.map((label, i) => {
                const complete = i < count
                const active = i === count && !isDone
                return (
                  <li key={label} className="flex items-center gap-3 py-1.5">
                    <span
                      className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 transition-colors ${
                        complete ? 'bg-emerald-500' : active ? 'bg-white border-2 border-indigo-300' : 'bg-white border-2 border-slate-200'
                      }`}
                    >
                      {complete ? (
                        <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3.2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                      ) : active ? (
                        <span className="w-2.5 h-2.5 rounded-full border-2 border-indigo-400 border-t-transparent animate-spin" />
                      ) : null}
                    </span>
                    <span className={`text-sm transition-colors ${complete ? 'text-slate-800 font-medium' : active ? 'text-slate-700' : 'text-slate-400'}`}>
                      {label}
                    </span>
                  </li>
                )
              })}
            </ul>
          </div>
        )}

        {/* Error action */}
        {isError && (
          <div className="px-7 pb-7">
            <button
              onClick={() => onClose?.()}
              className="w-full py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold transition-colors"
            >
              Close
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
