'use client'

import { useEffect, useRef, useState } from 'react'

// Friendly labels for role families / seniority bands shown on the intake
// card. The API only needs the raw codes — these are purely cosmetic.
const ROLE_LABELS = {
  'swe-backend': 'Senior Backend Engineer',
}
const SENIORITY_LABELS = {
  L3: 'Mid-Level (L3)',
  L4: 'Senior (L4)',
  L5: 'Staff (L5)',
  L6: 'Principal (L6)',
}

const TYPE_LABELS = {
  mcq: 'Multiple Choice',
  scenario_response: 'Scenario Response',
  coding: 'Coding Exercise',
}

function friendlyError(err) {
  const msg = err?.message || String(err)
  if (msg.includes('429') || msg.includes('quota') || msg.includes('rate') || msg.includes('Too Many')) {
    return 'Our system is temporarily busy. Please wait a moment and try again.'
  }
  if (msg.includes('fetch') || msg.includes('network') || msg.includes('Failed to fetch')) {
    return 'Connection error. Check your internet and try again.'
  }
  if (msg.includes('500') || msg.includes('Internal')) {
    return 'Something went wrong on our end. Please try again.'
  }
  return msg && msg !== 'Error' ? msg : 'Something went wrong. Please try again.'
}

function formatElapsed(ms) {
  const totalSec = Math.floor(ms / 1000)
  const m = Math.floor(totalSec / 60)
  const s = totalSec % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

/**
 * Single stateful client component driving the whole candidate assessment
 * flow: intake -> running (adaptive item loop) -> complete (results).
 * Modeled after components/InterviewExperience.js's phase state machine.
 *
 * Props:
 *  - roleFamily:    string  (default 'swe-backend')
 *  - seniorityBand: string  (default 'L4')
 *  - devMode:       bool    (cosmetic only — passed through from dev route)
 */
export default function AssessmentExperience({
  roleFamily = 'swe-backend',
  seniorityBand = 'L4',
  devMode = false,
  jobId = null,          // when set, ties the session to a job application
  returnTo = null,       // path to return to after completion (the application hub)
}) {
  const [phase, setPhase] = useState('intake') // 'intake' | 'running' | 'complete'
  const [sessionId, setSessionId] = useState(null)
  const [item, setItem] = useState(null)
  const [questionNumber, setQuestionNumber] = useState(0)
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  // Per-item response drafts
  const [selectedChoice, setSelectedChoice] = useState(null)
  const [textResponse, setTextResponse] = useState('')
  const [codeResponse, setCodeResponse] = useState('')

  // Elapsed timer since the current item was shown
  const [elapsedMs, setElapsedMs] = useState(0)
  const itemShownAtRef = useRef(null)

  // Results phase
  const [resultsLoading, setResultsLoading] = useState(false)
  const [resultsError, setResultsError] = useState('')
  const [sessionData, setSessionData] = useState(null) // { session, responses, skillDeltas, currentSkillGraph, report }

  useEffect(() => {
    if (phase !== 'running' || !item) return
    itemShownAtRef.current = Date.now()
    setElapsedMs(0)
    const interval = setInterval(() => {
      setElapsedMs(Date.now() - itemShownAtRef.current)
    }, 1000)
    return () => clearInterval(interval)
  }, [phase, item])

  function resetDrafts() {
    setSelectedChoice(null)
    setTextResponse('')
    setCodeResponse('')
  }

  async function startAssessment() {
    setError('')
    setLoading(true)
    try {
      const res = await fetch('/api/assessment/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roleFamily, seniorityBand, jobId }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || `Request failed (${res.status})`)
      }
      const data = await res.json()
      if (!data.item || data.status === 'no_items_available') {
        setError('No assessment items are available for this role right now. Please try again later.')
        return
      }
      setSessionId(data.sessionId)
      setItem(data.item)
      setQuestionNumber(1)
      resetDrafts()
      setPhase('running')
    } catch (err) {
      setError(friendlyError(err))
    } finally {
      setLoading(false)
    }
  }

  async function submitResponse() {
    if (!item || !sessionId || submitting) return

    let response
    if (item.type === 'mcq') {
      if (selectedChoice == null) return
      response = { choice_index: selectedChoice }
    } else if (item.type === 'scenario_response') {
      if (!textResponse.trim()) return
      response = { text: textResponse.trim() }
    } else if (item.type === 'coding') {
      if (!codeResponse.trim()) return
      response = { code: codeResponse }
    } else {
      response = {}
    }

    const timeSpentMs = itemShownAtRef.current ? Date.now() - itemShownAtRef.current : null
    setError('')
    setSubmitting(true)
    try {
      const res = await fetch('/api/assessment/respond', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, itemId: item.id, response, timeSpentMs }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || `Request failed (${res.status})`)
      }
      const data = await res.json()
      if (data.status === 'completed') {
        setPhase('complete')
        setItem(null)
        return
      }
      // in_progress -> advance to next item
      setItem(data.item)
      setQuestionNumber((n) => n + 1)
      resetDrafts()
    } catch (err) {
      setError(friendlyError(err))
    } finally {
      setSubmitting(false)
    }
  }

  // Fetch results as soon as we land in the complete phase.
  useEffect(() => {
    if (phase !== 'complete' || !sessionId) return
    let cancelled = false
    async function loadResults() {
      setResultsLoading(true)
      setResultsError('')
      try {
        const res = await fetch(`/api/assessment/${sessionId}`)
        if (!res.ok) {
          const data = await res.json().catch(() => ({}))
          throw new Error(data.error || `Request failed (${res.status})`)
        }
        const data = await res.json()
        if (!cancelled) setSessionData(data)
      } catch (err) {
        if (!cancelled) setResultsError(friendlyError(err))
      } finally {
        if (!cancelled) setResultsLoading(false)
      }
    }
    loadResults()
    return () => { cancelled = true }
  }, [phase, sessionId])

  function restart() {
    setPhase('intake')
    setSessionId(null)
    setItem(null)
    setQuestionNumber(0)
    resetDrafts()
    setError('')
    setSessionData(null)
    setResultsError('')
  }

  const roleLabel = ROLE_LABELS[roleFamily] || roleFamily
  const seniorityLabel = SENIORITY_LABELS[seniorityBand] || seniorityBand

  return (
    <div className="pb-10">
      <div className="container mx-auto max-w-3xl">
        <div className="mb-8 text-center">
          <span className="inline-block px-4 py-1.5 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-600 font-black text-[10px] uppercase tracking-[0.4em] mb-4">
            Skills Assessment{devMode ? ' · Dev' : ''}
          </span>
          <h1 className="text-3xl md:text-5xl font-black tracking-tight uppercase text-slate-900">
            {phase === 'complete' ? 'Results' : roleLabel}
          </h1>
          {phase === 'running' && (
            <p className="text-indigo-600 font-black uppercase tracking-widest text-xs mt-3">
              {seniorityLabel}
            </p>
          )}
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-2xl border border-red-200 bg-red-50 text-red-600 text-sm">
            {error}
          </div>
        )}

        {phase === 'intake' && (
          <div className="bg-white border border-slate-200 rounded-[2.5rem] p-8 md:p-12 shadow-xl shadow-indigo-500/5">
            <div className="grid gap-6">
              <p className="text-slate-500 text-sm leading-relaxed">
                A short adaptive assessment tailored to this role. Questions get
                harder or easier based on how you're doing — answer honestly and
                take your time.
              </p>

              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-2xl border border-slate-200 p-5">
                  <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">Role</p>
                  <p className="text-slate-900 font-black mt-2 text-sm">{roleLabel}</p>
                </div>
                <div className="rounded-2xl border border-slate-200 p-5">
                  <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">Level</p>
                  <p className="text-slate-900 font-black mt-2 text-sm">{seniorityLabel}</p>
                </div>
              </div>

              <button
                type="button"
                onClick={startAssessment}
                disabled={loading}
                className="btn-style-9 group uppercase tracking-widest text-xs shadow-2xl !px-12 !py-5 rounded-full font-black disabled:opacity-60 disabled:cursor-not-allowed justify-center"
              >
                <div className="btn-shimmer"></div>
                <span>{loading ? 'Starting…' : 'Start Assessment'}</span>
              </button>
            </div>
          </div>
        )}

        {phase === 'running' && item && (
          <div className="bg-white border border-slate-200 rounded-[2.5rem] p-8 md:p-12 shadow-xl shadow-indigo-500/5">
            <div className="flex items-center justify-between mb-6 text-xs">
              <span className="font-black uppercase tracking-[0.3em] text-slate-500">
                Question {questionNumber}
              </span>
              <div className="flex items-center gap-3">
                <span className="px-3 py-1 rounded-full bg-slate-100 text-slate-700 font-bold uppercase tracking-widest text-[10px]">
                  {TYPE_LABELS[item.type] || item.type}
                </span>
                <span className="text-slate-400 font-mono tabular-nums">{formatElapsed(elapsedMs)}</span>
              </div>
            </div>

            <p className="text-slate-900 text-lg leading-relaxed whitespace-pre-wrap mb-8">
              {item.prompt}
            </p>

            {item.type === 'mcq' && Array.isArray(item.rubric?.choices) && (
              <div className="grid gap-3 mb-8">
                {item.rubric.choices.map((choice, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setSelectedChoice(idx)}
                    className={`text-left px-5 py-4 rounded-2xl border transition ${
                      selectedChoice === idx
                        ? 'border-indigo-500 bg-indigo-50 text-slate-900'
                        : 'border-slate-300 text-slate-700 hover:border-slate-400'
                    }`}
                  >
                    <span className="flex items-center gap-3">
                      <span
                        className={`w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center ${
                          selectedChoice === idx ? 'border-indigo-400' : 'border-slate-300'
                        }`}
                      >
                        {selectedChoice === idx && <span className="w-2.5 h-2.5 rounded-full bg-indigo-400" />}
                      </span>
                      <span>{choice.text}</span>
                    </span>
                  </button>
                ))}
              </div>
            )}

            {item.type === 'scenario_response' && (
              <textarea
                rows={9}
                value={textResponse}
                onChange={(e) => setTextResponse(e.target.value)}
                placeholder="Walk through your reasoning and approach…"
                className="w-full px-5 py-4 mb-8 rounded-2xl border border-slate-300 bg-white text-slate-900 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none transition resize-y"
              />
            )}

            {item.type === 'coding' && (
              <textarea
                rows={14}
                value={codeResponse}
                onChange={(e) => setCodeResponse(e.target.value)}
                placeholder="// write your solution here"
                spellCheck={false}
                className="w-full px-5 py-4 mb-8 rounded-2xl border border-slate-300 bg-white text-slate-900 font-mono text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none transition resize-y"
              />
            )}

            <button
              type="button"
              onClick={submitResponse}
              disabled={
                submitting ||
                (item.type === 'mcq' && selectedChoice == null) ||
                (item.type === 'scenario_response' && !textResponse.trim()) ||
                (item.type === 'coding' && !codeResponse.trim())
              }
              className="btn-style-9 group uppercase tracking-widest text-xs shadow-2xl !px-12 !py-5 rounded-full font-black disabled:opacity-60 disabled:cursor-not-allowed justify-center w-full sm:w-auto"
            >
              <div className="btn-shimmer"></div>
              <span>{submitting ? 'Evaluating…' : 'Submit Answer'}</span>
            </button>
          </div>
        )}

        {phase === 'complete' && (
          <div className="bg-white border border-slate-200 rounded-[2.5rem] p-8 md:p-12 shadow-xl shadow-indigo-500/5">
            <div className="text-center mb-8">
              <span className="inline-block px-4 py-1.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-600 font-black text-[10px] uppercase tracking-[0.4em] mb-3">
                Assessment Complete
              </span>
              <h2 className="text-2xl md:text-3xl font-black uppercase tracking-tight text-slate-900">
                Great work
              </h2>
            </div>

            {resultsLoading && (
              <p className="text-slate-500 text-center animate-pulse">Compiling your results…</p>
            )}

            {resultsError && (
              <div className="p-4 rounded-2xl border border-red-200 bg-red-50 text-red-600 text-sm text-center">
                {resultsError}
              </div>
            )}

            {!resultsLoading && !resultsError && sessionData && (
              <ResultsSummary data={sessionData} />
            )}

            <div className="mt-10 flex flex-col sm:flex-row justify-center gap-3">
              {returnTo ? (
                <a
                  href={returnTo}
                  className="btn-style-9 group uppercase tracking-widest text-xs !px-10 !py-5 rounded-full font-black text-center"
                >
                  <div className="btn-shimmer"></div>
                  <span>Back to Application →</span>
                </a>
              ) : (
                <button
                  onClick={restart}
                  className="btn-style-9 group uppercase tracking-widest text-xs !px-10 !py-5 rounded-full font-black"
                >
                  <div className="btn-shimmer"></div>
                  <span>Take Another Assessment</span>
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function ResultsSummary({ data }) {
  const { report, responses = [], currentSkillGraph = [] } = data

  return (
    <div className="space-y-8">
      {report ? (
        <>
          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-2xl border border-slate-200 p-6 text-center">
              <p className="text-xs font-black uppercase tracking-[0.3em] text-slate-500">Score</p>
              <p className="text-4xl font-black text-indigo-600 mt-2">
                {report.overall_score != null ? `${report.overall_score}/10` : '—'}
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 p-6 text-center">
              <p className="text-xs font-black uppercase tracking-[0.3em] text-slate-500">Recommendation</p>
              <p className="text-xl font-black text-slate-900 mt-2 uppercase">
                {report.recommendation ? String(report.recommendation).replace(/_/g, ' ') : '—'}
              </p>
            </div>
          </div>

          {report.summary && (
            <div>
              <h3 className="text-xs font-black uppercase tracking-[0.3em] text-slate-500 mb-2">Summary</h3>
              <p className="text-slate-800 leading-relaxed">{report.summary}</p>
            </div>
          )}

          {Array.isArray(report.strengths) && report.strengths.length > 0 && (
            <div>
              <h3 className="text-xs font-black uppercase tracking-[0.3em] text-emerald-600 mb-2">Strengths</h3>
              <ul className="space-y-2 text-slate-800">
                {report.strengths.map((s, i) => (
                  <li key={i} className="pl-4 border-l-2 border-emerald-200">
                    {typeof s === 'string' ? s : s.claim || JSON.stringify(s)}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {Array.isArray(report.concerns) && report.concerns.length > 0 && (
            <div>
              <h3 className="text-xs font-black uppercase tracking-[0.3em] text-amber-600 mb-2">Concerns</h3>
              <ul className="space-y-2 text-slate-800">
                {report.concerns.map((c, i) => (
                  <li key={i} className="pl-4 border-l-2 border-amber-200">
                    {typeof c === 'string' ? c : c.claim || JSON.stringify(c)}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      ) : (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-center">
          <p className="text-amber-600 text-xs font-black uppercase tracking-[0.3em] mb-1">Full report pending</p>
          <p className="text-slate-700 text-sm">
            Your responses are recorded — a full narrative report will be available shortly.
            Here's how each question went:
          </p>
        </div>
      )}

      {!report && responses.length > 0 && (
        <div>
          <h3 className="text-xs font-black uppercase tracking-[0.3em] text-slate-500 mb-3">Responses</h3>
          <div className="grid gap-2">
            {responses.map((r) => (
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

      {currentSkillGraph.length > 0 && (
        <div>
          <h3 className="text-xs font-black uppercase tracking-[0.3em] text-slate-500 mb-3">Skill Graph</h3>
          <div className="grid gap-2">
            {currentSkillGraph.map((s) => (
              <div
                key={s.skill_code}
                className="flex items-center justify-between px-4 py-3 rounded-xl border border-slate-200 text-sm"
              >
                <span className="text-slate-800 font-bold">{s.skill_code}</span>
                <span className="text-slate-500">
                  θ {s.theta != null ? Number(s.theta).toFixed(2) : '—'}
                  {' · '}
                  {s.confidence != null ? `${Math.round(Number(s.confidence) <= 1 ? Number(s.confidence) * 100 : Number(s.confidence))}% confidence` : 'confidence pending'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {!report && responses.length === 0 && currentSkillGraph.length === 0 && (
        <p className="text-slate-500 text-center">No results available yet.</p>
      )}
    </div>
  )
}
