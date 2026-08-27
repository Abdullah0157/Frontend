'use client'

import { useEffect, useRef, useState } from 'react'
import VoiceChat from './VoiceChat'
import { primeTTS } from '@/lib/tts'

// Iris asks 5-7 questions depending on seniority. Set NEXT_PUBLIC_MAX_QUESTIONS=2
// to cap that for a quick end-to-end test run (question -> answer -> report ->
// save). Unset leaves the real, seniority-driven length untouched.
const QUESTION_CAP = Number(process.env.NEXT_PUBLIC_MAX_QUESTIONS) || 0
const capQuestions = (n) => (QUESTION_CAP > 0 ? Math.min(n, QUESTION_CAP) : n)

/**
 * Props:
 *  - job:      { id, slug, title, role, description } | null   (null => generic demo)
 *  - lockedRole: string | null
 *  - prefilledCandidate: { name, email } | null   (skips intake form when provided)
 *  - resumeText: string | null
 */
export default function InterviewExperience({
  job = null,
  lockedRole = null,
  prefilledCandidate = null,
  resumeText = null,
  cameraStream = null,
  screenStream = null,
  initialFocus = '',       // pre-fill the "Interview Focus" textarea
  initialTotalQuestions,   // override the default 5 questions
}) {
  const [phase, setPhase] = useState(prefilledCandidate ? 'chat' : 'intake')
  const [candidate, setCandidate] = useState({
    name: prefilledCandidate?.name || '',
    email: prefilledCandidate?.email || '',
    role: lockedRole || job?.role || '',
  })
  const [messages, setMessages] = useState([])
  const [draft, setDraft] = useState('')
  const [focusInput, setFocusInput] = useState(initialFocus)  // "Interview Focus" from intake form — one topic per line
  const [loading, setLoading] = useState(false)
  const [streamingQuestion, setStreamingQuestion] = useState('')
  const [report, setReport] = useState(null)
  const [error, setError] = useState('')
  const [savedCandidateId, setSavedCandidateId] = useState(null)
  const autoStartedRef = useRef(false)
  const sessionIdRef = useRef(null)
  if (!sessionIdRef.current) sessionIdRef.current = crypto.randomUUID()
  const scrollerRef = useRef(null)
  const cameraVideoRef = useRef(null)
  const screenVideoRef = useRef(null)
  const [screenStopped, setScreenStopped] = useState(false)
  const [primedContext, setPrimedContext] = useState(null)
  const [totalQuestions, setTotalQuestions] = useState(initialTotalQuestions || 5)
  const [priming, setPriming] = useState(false)

  useEffect(() => {
    if (cameraVideoRef.current && cameraStream) {
      cameraVideoRef.current.srcObject = cameraStream
    }
  }, [cameraStream])
  useEffect(() => {
    if (screenVideoRef.current && screenStream) {
      screenVideoRef.current.srcObject = screenStream
    }
    if (!screenStream) return
    const onEnd = () => setScreenStopped(true)
    screenStream.getTracks().forEach((t) => t.addEventListener('ended', onEnd))
    return () => screenStream.getTracks().forEach((t) => t.removeEventListener('ended', onEnd))
  }, [screenStream])

  useEffect(() => {
    return () => {
      try { cameraStream?.getTracks().forEach((t) => t.stop()) } catch {}
      try { screenStream?.getTracks().forEach((t) => t.stop()) } catch {}
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const answeredCount = messages.filter((m) => m.role === 'user').length
  const isJobScoped = !!job

  useEffect(() => {
    if (scrollerRef.current) scrollerRef.current.scrollTop = scrollerRef.current.scrollHeight
  }, [messages, loading])

  useEffect(() => {
    if (prefilledCandidate && job && messages.length === 0 && !autoStartedRef.current) {
      autoStartedRef.current = true
      startInterview()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefilledCandidate, job])

  async function callApi(path, body) {
    const res = await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      throw new Error(data.error || `Request failed (${res.status})`)
    }
    return res.json()
  }

  // Streams question text from the interview API, updating streamingQuestion as tokens arrive.
  // Returns the full question string when done.
  async function fetchQuestion(body) {
    const res = await fetch('/api/interview', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...body, action: 'question' }),
    })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      throw new Error(data.error || `Request failed (${res.status})`)
    }

    const contentType = res.headers.get('content-type') || ''
    if (contentType.includes('text/plain')) {
      // Streaming path — show tokens as they arrive
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

    // Fallback: server returned JSON (non-streaming path)
    const data = await res.json()
    return data.question
  }

  async function primeInterview() {
    if (!job?.id || !resumeText) return null
    setPriming(true)
    try {
      const res = await fetch('/api/interview/prime', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId: job.id, resumeText, sessionId: sessionIdRef.current }),
      })
      if (!res.ok) return null
      const { primedContext: ctx } = await res.json()
      if (ctx) {
        setPrimedContext(ctx)
        setTotalQuestions(capQuestions(ctx.totalQuestions || 5))
      }
      return ctx || null
    } catch {
      return null
    } finally {
      setPriming(false)
    }
  }

  function friendlyError(err) {
    const msg = err?.message || String(err)
    if (msg.includes('429') || msg.includes('quota') || msg.includes('rate') || msg.includes('Too Many')) {
      const match = msg.match(/retry in (\d+(?:\.\d+)?)s/i)
      const secs = match ? Math.ceil(parseFloat(match[1])) : null
      return secs
        ? `Our AI is temporarily busy. Please try again in about ${secs} second${secs !== 1 ? 's' : ''}.`
        : 'Our AI is temporarily busy. Please wait a moment and try again.'
    }
    if (msg.includes('fetch') || msg.includes('network') || msg.includes('Failed to fetch')) {
      return 'Connection error. Check your internet and try again.'
    }
    if (msg.includes('500') || msg.includes('Internal')) {
      return 'Something went wrong on our end. Please try again.'
    }
    return 'Something went wrong. Please try again.'
  }

  async function startInterview(e) {
    e?.preventDefault()
    if (!candidate.name.trim()) return
    if (!isJobScoped && !candidate.role.trim()) return
    primeTTS()
    // Note: no manual greeting here. Iris's stage_greeting directive in
    // questionInstruction() handles the first hello ("Hi there — good to
    // meet you..."). Playing a hardcoded greeting AND Iris's opener created
    // overlapping/double voices at interview start.
    setError('')
    setLoading(true)
    setStreamingQuestion('')

    // Parse user-supplied "Interview Focus" — one topic per line OR
    // comma-separated. Non-empty entries become primedContext.focusAreas,
    // which the state extractor surfaces to Iris as "INTERVIEW PRIORITIES"
    // in the director note.
    const userFocusTopics = focusInput
      .split(/\n|,/)
      .map((t) => t.trim())
      .filter(Boolean)
      .slice(0, 8)  // cap to keep the prompt tight

    try {
      // Prefer the API-primed context (when a job+resume exist) but merge
      // user-supplied topics as focus areas if provided.
      const apiCtx = await primeInterview()
      const ctx = userFocusTopics.length
        ? {
            ...(apiCtx || {}),
            focusAreas: [...(apiCtx?.questionFocus || apiCtx?.focusAreas || []), ...userFocusTopics],
            questionFocus: [...(apiCtx?.questionFocus || []), ...userFocusTopics],
          }
        : apiCtx
      if (ctx) setPrimedContext(ctx)
      const dynamicTotal = capQuestions(ctx?.totalQuestions || totalQuestions)
      const question = await fetchQuestion({
        candidate,
        messages: [],
        totalQuestions: dynamicTotal,
        jobId: job?.id,
        resumeText,
        sessionId: sessionIdRef.current,
        primedContext: ctx,
      })
      setStreamingQuestion('')
      setMessages([{ role: 'assistant', content: question }])
      setPhase('chat')
    } catch (err) {
      setStreamingQuestion('')
      setError(friendlyError(err))
    } finally {
      setLoading(false)
    }
  }

  async function submitAnswer(e, overrideText) {
    e?.preventDefault()
    const text = (overrideText ?? draft).trim()
    if (!text || loading) return
    setError('')
    const nextMessages = [...messages, { role: 'user', content: text }]
    setMessages(nextMessages)
    setDraft('')
    const newAnsweredCount = nextMessages.filter((m) => m.role === 'user').length
    setLoading(true)
    setStreamingQuestion('')
    try {
      if (newAnsweredCount >= totalQuestions) {
        setPhase('finishing')
        const { report: r } = await callApi('/api/interview', {
          action: 'report',
          candidate,
          messages: nextMessages,
          jobId: job?.id,
          resumeText,
          sessionId: sessionIdRef.current,
          primedContext,
        })
        setReport(r)
        if (isJobScoped) {
          try {
            const { candidate: saved } = await callApi(`/api/jobs/${job.id}/candidates`, {
              name: candidate.name,
              email: candidate.email || null,
              transcript: nextMessages,
              report: r,
              resumeText,
              sessionId: sessionIdRef.current,
            })
            setSavedCandidateId(saved?.id || null)
          } catch (saveErr) {
            console.error('Save failed:', saveErr)
            setError(`Report generated, but saving failed: ${saveErr.message}`)
          }
        }
        setPhase('report')
      } else {
        const question = await fetchQuestion({
          candidate,
          messages: nextMessages,
          totalQuestions,
          jobId: job?.id,
          resumeText,
          sessionId: sessionIdRef.current,
          primedContext,
        })
        setStreamingQuestion('')
        setMessages([...nextMessages, { role: 'assistant', content: question }])
      }
    } catch (err) {
      setStreamingQuestion('')
      setError(friendlyError(err))
    } finally {
      setLoading(false)
    }
  }

  function reset() {
    setPhase('intake')
    setCandidate({ name: '', email: '', role: lockedRole || job?.role || '' })
    setMessages([])
    setDraft('')
    setReport(null)
    setError('')
    setSavedCandidateId(null)
    setStreamingQuestion('')
  }

  return (
    <div className="min-h-screen pt-32 pb-24 px-4">
      {/* Proctoring overlays */}
      {cameraStream && (
        <div className="fixed bottom-6 left-6 z-[70] w-40 md:w-52 aspect-video rounded-3xl overflow-hidden shadow-2xl border border-slate-200 bg-slate-900">
          <video ref={cameraVideoRef} autoPlay muted playsInline className="w-full h-full object-cover" />
          <div className="absolute bottom-2 left-2 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-900/70 backdrop-blur">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-[10px] font-bold text-white">You</span>
          </div>
        </div>
      )}
      {screenStream && !screenStopped && (
        <div className="fixed top-20 right-6 z-[70] w-32 md:w-44 aspect-video rounded-2xl overflow-hidden shadow-2xl border border-slate-200 bg-slate-900">
          <video ref={screenVideoRef} autoPlay muted playsInline className="w-full h-full object-contain" />
          <div className="absolute bottom-2 left-2 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-900/70 backdrop-blur">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
            <span className="text-[10px] font-bold text-white">Screen</span>
          </div>
        </div>
      )}
      {screenStopped && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[80] px-5 py-3 rounded-2xl bg-red-600 text-white shadow-2xl text-sm font-black">
          ⚠ Screen sharing stopped — the company has been notified.
        </div>
      )}

      <div className="container mx-auto max-w-3xl">
        <div className="mb-8 text-center">
          <span className="inline-block px-4 py-1.5 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-600 font-black text-[10px] uppercase tracking-[0.4em] mb-4">
            Interview with Iris
          </span>
          <h1 className="text-3xl md:text-5xl font-black tracking-tight uppercase text-slate-900">
            {job ? job.title : 'Your Interview'}
          </h1>
          {job && (
            <p className="text-indigo-600 font-black uppercase tracking-widest text-xs mt-3">
              {job.role}
            </p>
          )}
          <p className="text-slate-500 mt-3">
            {priming
              ? <span className="text-indigo-600 animate-pulse">Reviewing your profile…</span>
              : `A quick ${totalQuestions}-question conversation. Answer honestly — there are no wrong answers.`
            }
          </p>
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-2xl border border-red-200 bg-red-50 text-red-600 text-sm">
            {error}
          </div>
        )}

        {phase === 'intake' && (
          <form
            onSubmit={startInterview}
            className="bg-white border border-slate-200 rounded-[2.5rem] p-8 md:p-12 shadow-xl shadow-indigo-500/5"
          >
            <div className="grid gap-6">
              <label className="block">
                <span className="text-xs font-black uppercase tracking-[0.3em] text-slate-700">
                  Your Name
                </span>
                <input
                  type="text"
                  required
                  value={candidate.name}
                  onChange={(e) => setCandidate({ ...candidate, name: e.target.value })}
                  placeholder="Jane Doe"
                  className="mt-2 w-full px-5 py-4 rounded-2xl border border-slate-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none transition"
                />
              </label>
              {isJobScoped && (
                <label className="block">
                  <span className="text-xs font-black uppercase tracking-[0.3em] text-slate-700">
                    Email (optional)
                  </span>
                  <input
                    type="email"
                    value={candidate.email}
                    onChange={(e) => setCandidate({ ...candidate, email: e.target.value })}
                    placeholder="jane@example.com"
                    className="mt-2 w-full px-5 py-4 rounded-2xl border border-slate-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none transition"
                  />
                </label>
              )}
              {!isJobScoped && (
                <label className="block">
                  <span className="text-xs font-black uppercase tracking-[0.3em] text-slate-700">
                    Role You're Applying For
                  </span>
                  <input
                    type="text"
                    required
                    value={candidate.role}
                    onChange={(e) => setCandidate({ ...candidate, role: e.target.value })}
                    placeholder="Senior Frontend Engineer"
                    className="mt-2 w-full px-5 py-4 rounded-2xl border border-slate-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none transition"
                  />
                </label>
              )}
              <label className="block">
                <span className="text-xs font-black uppercase tracking-[0.3em] text-slate-700">
                  Interview Focus <span className="text-slate-400 font-normal normal-case tracking-normal">(optional)</span>
                </span>
                <span className="block text-xs text-slate-500 mt-1 mb-2">
                  List 4–8 topics Iris should cover. One per line. She'll probe each across the interview.
                </span>
                <textarea
                  rows={5}
                  value={focusInput}
                  onChange={(e) => setFocusInput(e.target.value)}
                  placeholder={`e.g.\nSystem design experience at scale\nPast leadership of engineering teams\nHow they debug production incidents\nApproach to on-call and reliability\nTechnical decisions they later regretted`}
                  className="w-full px-5 py-4 rounded-2xl border border-slate-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none transition resize-y font-mono text-sm"
                />
              </label>
              <button
                type="submit"
                disabled={loading || !candidate.name.trim() || (!isJobScoped && !candidate.role.trim())}
                className="btn-style-9 group uppercase tracking-widest text-xs shadow-2xl !px-12 !py-5 rounded-full font-black disabled:opacity-60 disabled:cursor-not-allowed"
              >
                <div className="btn-shimmer"></div>
                <span>{loading ? 'Starting…' : 'Start Interview'}</span>
              </button>
            </div>
          </form>
        )}

        {(phase === 'chat' || phase === 'finishing') && (
          <VoiceChat
            messages={messages}
            loading={loading}
            finishing={phase === 'finishing'}
            streamingQuestion={streamingQuestion}
            onSubmit={(text) => {
              setDraft(text)
              submitAnswer(undefined, text)
            }}
            totalQuestions={totalQuestions}
            sttContext={candidate.role || job?.role || ''}
          />
        )}

        {phase === 'report' && (
          <div className="bg-white border border-slate-200 rounded-[2.5rem] p-8 md:p-12 shadow-xl shadow-indigo-500/5">
            <div className="text-center mb-8">
              <span className="inline-block px-4 py-1.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-600 font-black text-[10px] uppercase tracking-[0.4em] mb-3">
                Interview Complete
              </span>
              <h2 className="text-2xl md:text-3xl font-black uppercase tracking-tight text-slate-900">
                {isJobScoped ? 'Thanks for applying' : 'Screening Report'}
              </h2>
              <p className="text-slate-500 mt-1 text-sm">
                {candidate.name}{job ? ` — ${job.title}` : candidate.role ? ` — ${candidate.role}` : ''}
              </p>
              {isJobScoped && savedCandidateId && (
                <p className="text-emerald-600 text-xs mt-3">
                  ✓ Your submission has been sent to the hiring team.
                </p>
              )}
            </div>

            {report ? (
              <div className="space-y-8">
                <div className="grid grid-cols-2 gap-4">
                  <div className="rounded-2xl border border-slate-200 p-6 text-center">
                    <p className="text-xs font-black uppercase tracking-[0.3em] text-slate-500">Score</p>
                    <p className="text-4xl font-black text-indigo-600 mt-2">{report.score}/10</p>
                  </div>
                  <div className="rounded-2xl border border-slate-200 p-6 text-center">
                    <p className="text-xs font-black uppercase tracking-[0.3em] text-slate-500">Recommendation</p>
                    <p className="text-2xl font-black text-slate-900 mt-2 uppercase">
                      {String(report.recommendation || '').replace('_', ' ')}
                    </p>
                  </div>
                </div>

                {/* Evidence quality banner — only shown when report self-flags OR validator disagrees */}
                {report.validation && (report.validation.computed_evidence_quality === 'low' ||
                  report.validation.unverified_direct_quotes > 0 ||
                  report.validation.invalid_turn_refs > 0 ||
                  report.validation.structural_issues?.length > 0) && (
                  <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                    <p className="text-xs font-black uppercase tracking-[0.3em] text-amber-600 mb-1">Evidence Quality: {report.validation.computed_evidence_quality}</p>
                    <p className="text-xs text-slate-700 leading-relaxed">
                      Verification rate: {Math.round((report.validation.direct_quote_verification_rate || 0) * 100)}% ·
                      {report.validation.verified_direct_quotes} verified quotes ·
                      {report.validation.unverified_direct_quotes > 0 && ` ${report.validation.unverified_direct_quotes} unverified ·`}
                      {report.validation.invalid_turn_refs > 0 && ` ${report.validation.invalid_turn_refs} bad turn refs ·`}
                      {' '}review this report with extra scrutiny.
                    </p>
                  </div>
                )}

                <div>
                  <h3 className="text-xs font-black uppercase tracking-[0.3em] text-slate-500 mb-2">Summary</h3>
                  <p className="text-slate-800 leading-relaxed">{report.summary}</p>
                </div>
                {Array.isArray(report.strengths) && report.strengths.length > 0 && (
                  <div>
                    <h3 className="text-xs font-black uppercase tracking-[0.3em] text-emerald-600 mb-2">Strengths</h3>
                    <ul className="space-y-3 text-slate-800">
                      {report.strengths.map((s, i) => (
                        <li key={i} className="pl-4 border-l-2 border-emerald-200">
                          {typeof s === 'string' ? s : (
                            <>
                              <div>{s.claim}</div>
                              {s.evidence && (
                                <div className="text-xs text-slate-500 mt-1 italic">
                                  Turn {s.evidence.turn} · {s.evidence.quote_type === 'direct' ? 'quote' : 'paraphrase'}: "{s.evidence.quote}"
                                </div>
                              )}
                            </>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {Array.isArray(report.concerns) && report.concerns.length > 0 && (
                  <div>
                    <h3 className="text-xs font-black uppercase tracking-[0.3em] text-amber-600 mb-2">Concerns</h3>
                    <ul className="space-y-3 text-slate-800">
                      {report.concerns.map((c, i) => (
                        <li key={i} className="pl-4 border-l-2 border-amber-200">
                          {typeof c === 'string' ? c : (
                            <>
                              <div>{c.claim}</div>
                              {c.evidence && (
                                <div className="text-xs text-slate-500 mt-1 italic">
                                  Turn {c.evidence.turn} · {c.evidence.quote_type === 'direct' ? 'quote' : 'paraphrase'}: "{c.evidence.quote}"
                                </div>
                              )}
                            </>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {(report.highlight_moment || report.highlight_quote) && (
                  <blockquote className="border-l-4 border-indigo-500 pl-4 italic text-slate-700">
                    {typeof report.highlight_moment === 'object' ? (
                      <>
                        "{report.highlight_moment.quote}"
                        {report.highlight_moment.why_notable && (
                          <div className="text-xs text-slate-400 mt-2 not-italic">
                            Turn {report.highlight_moment.turn} — {report.highlight_moment.why_notable}
                          </div>
                        )}
                      </>
                    ) : (
                      `"${report.highlight_quote}"`
                    )}
                  </blockquote>
                )}
              </div>
            ) : (
              <p className="text-slate-500">No structured report was returned. Try again.</p>
            )}

            <div className="mt-10 flex flex-col sm:flex-row justify-center gap-3">
              {isJobScoped ? (
                <a
                  href="/jobs"
                  className="btn-style-9 group uppercase tracking-widest text-xs !px-10 !py-5 rounded-full font-black text-center"
                >
                  <div className="btn-shimmer"></div>
                  <span>Browse more jobs</span>
                </a>
              ) : (
                <button onClick={reset} className="btn-style-9 group uppercase tracking-widest text-xs !px-10 !py-5 rounded-full font-black">
                  <div className="btn-shimmer"></div>
                  <span>New Interview</span>
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
