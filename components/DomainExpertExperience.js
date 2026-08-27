'use client'

import { useEffect, useRef, useState } from 'react'
import VoiceChat from './VoiceChat'
import { primeTTS } from '@/lib/tts'

// Time-based interview. progressRatio = elapsed / DURATION drives Maya's phasing
// (intro → warmup → breadth → depth → edge cases → close), so shortening the
// duration compresses the whole arc rather than truncating it — a 5-minute run
// still moves through every phase, just faster. Set NEXT_PUBLIC_INTERVIEW_MINUTES=5
// for quick end-to-end testing; unset defaults to the real 30-minute interview.
const INTERVIEW_MINUTES = Number(process.env.NEXT_PUBLIC_INTERVIEW_MINUTES) || 30
const DURATION_S = INTERVIEW_MINUTES * 60
const MAX_QUESTIONS = 40 // safety cap so it can't loop forever if the timer breaks

export default function DomainExpertExperience({ userProfile = null }) {
  // Phases: detecting (AI reads resume) → ready → chat → finishing → report → error_no_resume
  const [phase, setPhase] = useState('detecting')
  const [detected, setDetected] = useState(null) // { name, domain, seniority, focusAreas, headline, resumeText }
  const [messages, setMessages] = useState([])
  const [loading, setLoading] = useState(false)
  const [streamingQuestion, setStreamingQuestion] = useState('')
  const [report, setReport] = useState(null)
  const [saveState, setSaveState] = useState('idle') // idle | saved | failed
  const [error, setError] = useState('')
  const [noResume, setNoResume] = useState(false)
  const [elapsedSec, setElapsedSec] = useState(0)
  const startTimeRef = useRef(null)
  const sessionIdRef = useRef(null)
  if (!sessionIdRef.current) sessionIdRef.current = crypto.randomUUID()
  // DEIE belief-loop state carried across turns (step 4/5).
  const lastPlanRef = useRef(null)      // { belief, target_id } for the Critic
  const turnsSpentRef = useRef({})      // competency_id → # times targeted (anti-repetition)
  const evasionsRef = useRef(0)         // count of unresolved dodges (feeds quality score)
  // Belief loop runs OFF the critical path: it steers the NEXT question and can
  // flag early-conclude, so it never blocks the question the candidate is waiting
  // for. These carry its result forward one turn.
  const pendingTargetRef = useRef(null) // next_target from last turn's plan → steers this turn
  const concludeSoonRef = useRef(false) // last plan judged the decision stable → wrap up
  const planSeqRef = useRef(0)          // monotonic guard so only the latest plan applies

  // ── Detect domain from resume on mount ──────────────────────────────────────
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch('/api/interview/detect-domain', { method: 'POST', cache: 'no-store' })
        const data = await res.json()
        if (cancelled) return
        if (!res.ok) {
          // 400 = genuinely no resume on file → show the upload CTA.
          // Anything else (503/500/etc) = transient → offer a retry instead.
          setNoResume(res.status === 400)
          setError(data.error || 'Could not read your resume.')
          setPhase('error_no_resume')
          return
        }
        setDetected({
          name: data.name || userProfile?.full_name || '',
          domain: data.domain || 'your field',
          seniority: data.seniority || 'mid',
          focusAreas: data.focusAreas || [],
          headline: data.headline || '',
          resumeText: data.resumeText || userProfile?.resume_text || '',
        })
        setPhase('ready')
      } catch {
        if (!cancelled) { setError('Connection error. Please refresh.'); setPhase('error_no_resume') }
      }
    })()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Interview timer ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (phase !== 'chat') return
    const t = setInterval(() => {
      if (startTimeRef.current) {
        setElapsedSec(Math.floor((Date.now() - startTimeRef.current) / 1000))
      }
    }, 1000)
    return () => clearInterval(t)
  }, [phase])

  const remainingS = Math.max(0, DURATION_S - elapsedSec)
  const progressRatio = Math.min(1, elapsedSec / DURATION_S)
  const timerLabel = phase === 'chat'
    ? (remainingS > 0
        ? `${String(Math.floor(remainingS / 60)).padStart(2, '0')}:${String(remainingS % 60).padStart(2, '0')} LEFT`
        : 'WRAPPING UP')
    : null

  function friendlyError(err) {
    const msg = err?.message || String(err)
    if (msg.includes('429') || msg.includes('quota') || msg.includes('rate')) {
      return 'Our AI is temporarily busy. Please wait a moment and try again.'
    }
    if (msg.includes('fetch') || msg.includes('network')) return 'Connection error. Check your internet and try again.'
    return 'Something went wrong. Please try again.'
  }

  async function fetchQuestion(body) {
    const res = await fetch('/api/interview', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...body, action: 'question', assessmentType: 'domain_expert' }),
    })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      throw new Error(data.error || `Request failed (${res.status})`)
    }
    const contentType = res.headers.get('content-type') || ''
    if (contentType.includes('text/plain')) {
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let question = ''
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        question += decoder.decode(value, { stream: true })
        setStreamingQuestion(question)
      }
      question += decoder.decode()
      return question.trim()
    }
    const data = await res.json()
    return data.question
  }

  function questionBody(msgs, beliefTarget = null) {
    return {
      candidate: { name: detected.name, role: detected.domain },
      messages: msgs,
      totalQuestions: MAX_QUESTIONS,
      resumeText: detected.resumeText,
      domainExpertise: detected.domain,
      focusAreas: detected.focusAreas,
      progressRatio: Math.min(1, elapsedSec / DURATION_S),
      sessionId: sessionIdRef.current,
      beliefTarget,
      clientBelief: true, // client drives the belief loop → server must NOT re-score
    }
  }

  // DEIE belief loop: score the transcript-so-far → next target + whether the
  // hiring decision is now stable enough to conclude. Best-effort (returns null
  // on rate-limit/error, so the interview falls back to time/question limits).
  async function fetchPlan(msgs) {
    try {
      // Bound the belief-loop latency: if scoring is slow (rate-limited), give up
      // and let the question proceed with phase-based guidance rather than hang.
      const ctrl = new AbortController()
      const timer = setTimeout(() => ctrl.abort(), 12000)
      const res = await fetch('/api/interview/plan/next', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          role: detected.domain,
          messages: msgs,
          resumeText: detected.resumeText,
          prev: lastPlanRef.current,
          turnsSpent: turnsSpentRef.current,
        }),
        signal: ctrl.signal,
      }).finally(() => clearTimeout(timer))
      if (!res.ok) return null
      const plan = await res.json()
      // Critic: count unresolved evasions for the interview-quality score.
      if (plan?.critique?.evasive) evasionsRef.current += 1
      // Remember this turn's belief + target so the next turn can critique it,
      // and increment anti-repetition counters.
      if (plan?.next_target) {
        const id = plan.next_target.competency_id
        turnsSpentRef.current[id] = (turnsSpentRef.current[id] || 0) + 1
        lastPlanRef.current = { belief: plan.belief, target_id: id }
      }
      return plan
    } catch { return null }
  }

  async function startInterview() {
    if (!detected) return
    primeTTS()
    setError('')
    setLoading(true)
    setStreamingQuestion('')
    startTimeRef.current = Date.now()
    setElapsedSec(0)
    setPhase('chat')
    try {
      const question = await fetchQuestion(questionBody([]))
      setStreamingQuestion('')
      setMessages([{ role: 'assistant', content: question }])
    } catch (err) {
      setStreamingQuestion('')
      setError(friendlyError(err))
    } finally {
      setLoading(false)
    }
  }

  async function generateReport(finalMessages) {
    setPhase('finishing')
    try {
      const res = await fetch('/api/interview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'report',
          assessmentType: 'domain_expert',
          candidate: { name: detected.name, role: detected.domain },
          messages: finalMessages,
          resumeText: detected.resumeText,
          domainExpertise: detected.domain,
          sessionId: sessionIdRef.current,
        }),
      })
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Report failed')
      const { report: r } = await res.json()
      setReport(r)
      setPhase('report')

      // Persist the assessment so it shows in the dashboard / My Interviews and
      // admins can audit it. This must not block the candidate from seeing their
      // report, but it also must not fail SILENTLY — a lost save means a finished
      // interview vanishes. So: retry, then tell the user if it still failed.
      if (r) {
        const payload = JSON.stringify({
          domain: detected.domain, transcript: finalMessages, report: r, evasions: evasionsRef.current,
        })
        ;(async () => {
          for (let attempt = 1; attempt <= 3; attempt++) {
            try {
              const saveRes = await fetch('/api/interview/save-expert-report', {
                method: 'POST', headers: { 'Content-Type': 'application/json' }, body: payload,
              })
              if (saveRes.ok) { setSaveState('saved'); return }
            } catch { /* network blip — retry below */ }
            if (attempt < 3) await new Promise(res => setTimeout(res, attempt * 1500))
          }
          setSaveState('failed')
        })()
      }
    } catch (err) {
      setError(friendlyError(err))
      setPhase('report')
    }
  }

  async function submitAnswer(text) {
    if (!text || loading) return
    setError('')
    const nextMessages = [...messages, { role: 'user', content: text }]
    setMessages(nextMessages)
    const answered = nextMessages.filter((m) => m.role === 'user').length
    setLoading(true)
    setStreamingQuestion('')

    // Time's up, safety cap, or the belief loop already judged the decision
    // stable last turn → wrap into a report.
    const timeUp = startTimeRef.current && (Date.now() - startTimeRef.current) / 1000 >= DURATION_S
    if (timeUp || answered >= MAX_QUESTIONS || concludeSoonRef.current) {
      await generateReport(nextMessages)
      setLoading(false)
      return
    }

    try {
      // DEIE belief loop — scores the transcript-so-far to steer the FOLLOWING
      // question at the weakest competency. It's "background", but on the LOCAL
      // model each scoring pass is a 60-90s inference that pegs the machine and
      // the passes pile up (Ollama runs one at a time), choking the whole UI
      // mid-interview. So skip per-turn scoring when NEXT_PUBLIC_SKIP_BELIEF_LOOP
      // is set (local mode): questions fall back to phase-based guidance (still
      // good), and the full EIE scoring runs ONCE at report time. Cloud mode
      // keeps the live belief loop (scoring there is ~2s).
      if (process.env.NEXT_PUBLIC_SKIP_BELIEF_LOOP !== '1') {
        const seq = ++planSeqRef.current
        fetchPlan(nextMessages).then((plan) => {
          if (seq !== planSeqRef.current || !plan) return // superseded by a newer turn
          pendingTargetRef.current = plan.next_target || null
          if (plan.ready_to_conclude) concludeSoonRef.current = true
        }).catch(() => {})
      }

      // Generate the question NOW, steered by the previous turn's target (or
      // phase-based guidance on the first turn, when it's null).
      const question = await fetchQuestion(questionBody(nextMessages, pendingTargetRef.current))
      setStreamingQuestion('')
      setMessages([...nextMessages, { role: 'assistant', content: question }])
    } catch (err) {
      setStreamingQuestion('')
      setError(friendlyError(err))
    } finally {
      setLoading(false)
    }
  }

  // Manual end — user clicks "End & get report".
  async function endEarly() {
    if (loading || phase !== 'chat') return
    if (messages.filter((m) => m.role === 'user').length === 0) {
      // Nothing answered yet — just bail back to ready.
      setPhase('ready'); return
    }
    setLoading(true)
    await generateReport(messages)
    setLoading(false)
  }

  const form = { name: detected?.name || '', domain: detected?.domain || '' } // for report header reuse

  function reset() {
    setPhase('ready')
    setMessages([])
    setReport(null)
    setError('')
    setStreamingQuestion('')
    setElapsedSec(0)
    startTimeRef.current = null
    sessionIdRef.current = crypto.randomUUID()
    lastPlanRef.current = null
    turnsSpentRef.current = {}
    evasionsRef.current = 0
    pendingTargetRef.current = null
    concludeSoonRef.current = false
    planSeqRef.current = 0
  }

  const levelColors = {
    beginner: 'text-slate-500', developing: 'text-amber-600', proficient: 'text-blue-600',
    advanced: 'text-indigo-600', expert: 'text-emerald-600', master: 'text-purple-600',
  }

  return (
    <div className="max-w-2xl mx-auto py-10 px-4">
      {error && (
        <div className="mb-6 p-4 rounded-xl border border-red-200 bg-red-50 text-red-700 text-sm">{error}</div>
      )}

      {phase === 'detecting' && (
        <div className="rounded-2xl border border-gray-200 bg-white p-10 text-center">
          <div className="w-10 h-10 mx-auto mb-4 rounded-full border-2 border-indigo-200 border-t-indigo-600 animate-spin" />
          <p className="text-sm font-medium text-gray-900">Reading your resume…</p>
          <p className="text-xs text-gray-400 mt-1">Maya is figuring out your domain and what to explore.</p>
        </div>
      )}

      {phase === 'error_no_resume' && (
        noResume ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center max-w-xl mx-auto shadow-sm">
            <div className="w-14 h-14 mx-auto mb-5 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center">
              <svg className="w-7 h-7 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-slate-900 mb-1">Upload your resume first</h2>
            <p className="text-slate-500 mb-6 max-w-sm mx-auto">
              Maya builds the interview around your actual experience, so we need your resume on file before you start.
            </p>
            <a
              href="/dashboard/profile?tab=resume"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold transition-colors"
            >
              Upload Resume →
            </a>
          </div>
        ) : (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-8 text-center max-w-xl mx-auto">
            <p className="text-sm font-semibold text-red-700 mb-1">Couldn't start the interview</p>
            <p className="text-sm text-red-600 mb-5">{error || 'Something went wrong. Please try again.'}</p>
            <button
              onClick={() => { setError(''); setNoResume(false); setPhase('detecting'); window.location.reload() }}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold transition-colors"
            >
              Try again
            </button>
          </div>
        )
      )}

      {phase === 'ready' && detected && (
        <div className="rounded-2xl border border-gray-200 bg-white p-8">
          <p className="text-xs font-semibold tracking-widest text-indigo-500 uppercase mb-2">Ready to begin</p>
          <h2 className="text-xl font-semibold text-gray-900">
            A 30-minute conversation about <span className="text-indigo-600">{detected.domain}</span>
          </h2>
          {detected.headline && <p className="text-sm text-gray-500 mt-1">{detected.headline}</p>}

          {detected.focusAreas?.length > 0 && (
            <div className="mt-5">
              <p className="text-xs font-semibold tracking-widest text-gray-400 uppercase mb-2">Maya will explore</p>
              <div className="flex flex-wrap gap-2">
                {detected.focusAreas.map((a, i) => (
                  <span key={i} className="px-3 py-1 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-700 text-xs font-medium">{a}</span>
                ))}
              </div>
            </div>
          )}

          <ul className="mt-6 space-y-2 text-sm text-gray-600">
            <li className="flex gap-2"><span className="text-indigo-500">1.</span> She'll start by asking you to introduce yourself.</li>
            <li className="flex gap-2"><span className="text-indigo-500">2.</span> Then she'll dig into the specifics of your real work.</li>
            <li className="flex gap-2"><span className="text-indigo-500">3.</span> It runs for about 30 minutes — speak naturally, out loud.</li>
          </ul>

          <button
            onClick={startInterview}
            disabled={loading}
            className="mt-7 w-full py-3.5 px-6 rounded-lg bg-gray-900 hover:bg-gray-700 disabled:opacity-50 text-white text-sm font-semibold transition-colors"
          >
            {loading ? 'Starting…' : 'Start Interview'}
          </button>
          <p className="mt-3 text-xs text-center text-gray-400">Voice interview with Maya · Make sure your mic is on</p>
        </div>
      )}

      {(phase === 'chat' || phase === 'finishing') && (
        <VoiceChat
          messages={messages}
          loading={loading}
          finishing={phase === 'finishing'}
          streamingQuestion={streamingQuestion}
          onSubmit={submitAnswer}
          totalQuestions={MAX_QUESTIONS}
          headerLabel={timerLabel}
          onEnd={endEarly}
          aiName="Maya"
          voice="en-GB-SoniaNeural"
          sttContext={[detected?.domain, ...(detected?.focusAreas || [])].filter(Boolean).join(', ')}
        />
      )}

      {phase === 'report' && report && (
        <div className="space-y-6">
          {/* Header */}
          <div className="text-center pb-6 border-b border-gray-200">
            <p className="text-xs font-semibold tracking-widest text-gray-400 uppercase mb-2">Assessment Complete</p>
            <h2 className="text-2xl font-semibold text-gray-900">{form.name}</h2>
            <p className="text-base text-gray-500 mt-1">{form.domain}</p>
          </div>

          {/* Verdict — the one thing a reader should take away, stated plainly
              and colour-banded. A bare number forces people to guess what "6.2"
              means; the band and sentence remove that guesswork. */}
          {(() => {
            const s = Number(report.expertise_score) || 0
            const band = s >= 8 ? {
              tone: 'emerald', label: 'Strong expertise verified',
              note: 'Answers were specific, evidenced, and held up under follow-up questions.',
            } : s >= 6.5 ? {
              tone: 'blue', label: 'Solid expertise',
              note: 'Good working knowledge, with some areas that were not fully evidenced.',
            } : s >= 4 ? {
              tone: 'amber', label: 'Partly evidenced',
              note: 'Some real knowledge came through, but key areas need more depth.',
            } : {
              tone: 'slate', label: 'Not enough evidence',
              note: 'The interview did not surface enough detail to verify expertise.',
            }
            const ring = { emerald: 'border-emerald-300 bg-emerald-50', blue: 'border-blue-300 bg-blue-50', amber: 'border-amber-300 bg-amber-50', slate: 'border-slate-300 bg-slate-50' }[band.tone]
            const text = { emerald: 'text-emerald-700', blue: 'text-blue-700', amber: 'text-amber-700', slate: 'text-slate-600' }[band.tone]
            const conf = Math.round((Number(report.overall_confidence) || 0) * 100)
            return (
              <div className={`rounded-2xl border ${ring} p-6`}>
                <div className="flex items-center gap-5">
                  <div className="shrink-0 text-center">
                    <p className="text-5xl font-black text-gray-900 leading-none tabular-nums">{report.expertise_score}</p>
                    <p className="text-xs text-gray-400 mt-1">out of 10</p>
                  </div>
                  <div className="min-w-0">
                    <p className={`text-lg font-bold ${text}`}>{band.label}</p>
                    <p className="text-sm text-gray-600 mt-1">{band.note}</p>
                    <div className="flex flex-wrap items-center gap-2 mt-3">
                      <span className={`px-2.5 py-1 rounded-full bg-white border text-xs font-semibold capitalize ${levelColors[report.expertise_level] || 'text-gray-700'}`}>
                        {report.expertise_level}
                      </span>
                      {conf > 0 && (
                        <span className="px-2.5 py-1 rounded-full bg-white border border-gray-200 text-xs text-gray-500">
                          {conf}% confidence in this result
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )
          })()}

          {/* Summary */}
          {report.domain_summary && (
            <div>
              <p className="text-xs font-semibold tracking-widest text-gray-400 uppercase mb-2">Summary</p>
              <p className="text-sm text-gray-700 leading-relaxed">{report.domain_summary}</p>
            </div>
          )}

          {/* Domain areas */}
          {report.domain_areas?.length > 0 && (
            <div>
              <p className="text-xs font-semibold tracking-widest text-gray-400 uppercase mb-2">Verified Domain Areas</p>
              <div className="flex flex-wrap gap-2">
                {report.domain_areas.map((a, i) => (
                  <span key={i} className="px-3 py-1 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-700 text-xs font-medium">{a}</span>
                ))}
              </div>
            </div>
          )}

          {/* Unique value */}
          {report.unique_value && (
            <div>
              <p className="text-xs font-semibold tracking-widest text-gray-400 uppercase mb-2">Unique Value</p>
              <p className="text-sm text-gray-700 leading-relaxed">{report.unique_value}</p>
            </div>
          )}

          {/* Credibility signals */}
          {report.credibility_signals?.length > 0 && (
            <div>
              <p className="text-xs font-semibold tracking-widest text-emerald-600 uppercase mb-2">Credibility Signals</p>
              <ul className="space-y-1.5">
                {report.credibility_signals.map((s, i) => (
                  <li key={i} className="flex gap-2 text-sm text-gray-700">
                    <span className="text-emerald-500 mt-0.5">&#10003;</span>{s}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Competency breakdown — each score shown WITH the quote that earned
              it. The model already returns dimension_evidence and per-dimension
              confidence; showing them is what turns a number into something a
              candidate (or a hiring manager) can actually trust and argue with. */}
          {report.internal_scores && (
            <div>
              <p className="text-xs font-semibold tracking-widest text-gray-400 uppercase mb-3">What each score is based on</p>
              <div className="space-y-3">
                {Object.entries(report.internal_scores).map(([key, val]) => {
                  const quote = report.dimension_evidence?.[key]
                  const conf = report.score_confidence?.[key]
                  const tone = val >= 8 ? 'bg-emerald-500' : val >= 6 ? 'bg-blue-500' : val >= 4 ? 'bg-amber-500' : 'bg-slate-400'
                  return (
                    <div key={key} className="rounded-xl border border-gray-200 p-4">
                      <div className="flex items-center gap-3">
                        <span className="flex-1 text-sm font-semibold text-gray-800 capitalize">{key.replace(/_/g, ' ')}</span>
                        {conf != null && (
                          <span className="text-[11px] text-gray-400">{Math.round(Number(conf) * 100)}% confidence</span>
                        )}
                        <span className="text-sm font-bold text-gray-900 tabular-nums w-10 text-right">{val}/10</span>
                      </div>
                      <div className="mt-2 h-1.5 rounded-full bg-gray-100">
                        <div className={`h-1.5 rounded-full ${tone}`} style={{ width: `${(val / 10) * 100}%` }} />
                      </div>
                      {quote && (
                        <p className="mt-3 text-xs text-gray-600 italic border-l-2 border-gray-200 pl-3 leading-relaxed">
                          &ldquo;{quote}&rdquo;
                        </p>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Standout moment */}
          {report.standout_moment && (
            <blockquote className="border-l-4 border-indigo-500 pl-4 py-1">
              <p className="text-sm italic text-gray-600">"{report.standout_moment}"</p>
            </blockquote>
          )}

          {/* Recommended use cases */}
          {report.recommended_use_cases?.length > 0 && (
            <div>
              <p className="text-xs font-semibold tracking-widest text-gray-400 uppercase mb-2">Best Fit For</p>
              <ul className="space-y-1">
                {report.recommended_use_cases.map((u, i) => (
                  <li key={i} className="text-sm text-gray-700">• {u}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Knowledge gaps */}
          {report.knowledge_gaps?.length > 0 && (
            <div>
              <p className="text-xs font-semibold tracking-widest text-amber-600 uppercase mb-2">Areas to Develop</p>
              <ul className="space-y-1">
                {report.knowledge_gaps.map((g, i) => (
                  <li key={i} className="text-sm text-amber-700">• {g}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="pt-4 border-t border-gray-200 flex gap-3">
            <button onClick={reset} className="px-5 py-2.5 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
              New Assessment
            </button>
          </div>
        </div>
      )}

      {phase === 'report' && !report && (
        <div className="text-center py-10">
          <p className="text-gray-500 text-sm">No report returned. Please try again.</p>
          <button onClick={reset} className="mt-4 px-5 py-2.5 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50">
            Try Again
          </button>
        </div>
      )}
    </div>
  )
}
