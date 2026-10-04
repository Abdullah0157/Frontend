'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

// Candidate flow for the written assessment (frameworks/swe-assessment-design.md):
// intake -> section intro -> items (timed per section) -> ... -> finished.
// The server owns the timer, the order and the scoring; this component only
// shows what /api/assessment/* returns and sends answers back.

const LEVEL_LABELS = { L2: 'Junior', L3: 'Mid', L4: 'Senior', L5: 'Lead' }
const STORE_KEY = 'jobstream.written-assessment'

function readStore() {
  try { return JSON.parse(sessionStorage.getItem(STORE_KEY) || 'null') } catch { return null }
}
function writeStore(v) {
  try { v ? sessionStorage.setItem(STORE_KEY, JSON.stringify(v)) : sessionStorage.removeItem(STORE_KEY) } catch {}
}

// Prompts are plain text with ``` fenced code blocks and `inline code`.
function RichText({ text }) {
  const parts = []
  const re = /```[a-zA-Z]*\n([\s\S]*?)```/g
  let last = 0
  let m
  while ((m = re.exec(text || ''))) {
    if (m.index > last) parts.push({ kind: 'text', value: text.slice(last, m.index) })
    parts.push({ kind: 'code', value: m[1] })
    last = re.lastIndex
  }
  if (last < (text || '').length) parts.push({ kind: 'text', value: text.slice(last) })
  return (
    <div className="space-y-4">
      {parts.map((p, i) => p.kind === 'code'
        ? <CodeBlock key={i} code={p.value} />
        : <TextBlock key={i} text={p.value} />)}
    </div>
  )
}

// **bold**, `code`, and paragraphs / "- " bullet lists separated by blank lines.
function Inline({ text }) {
  return text.split(/(`[^`]+`|\*\*[^*]+\*\*)/).map((seg, k) => {
    if (seg.startsWith('`') && seg.endsWith('`') && seg.length > 1) {
      return <code key={k} className="px-1.5 py-0.5 rounded bg-slate-100 text-indigo-700 font-mono text-[0.9em]">{seg.slice(1, -1)}</code>
    }
    if (seg.startsWith('**') && seg.endsWith('**') && seg.length > 4) return <strong key={k}>{seg.slice(2, -2)}</strong>
    return seg
  })
}

function TextBlock({ text }) {
  const blocks = text.trim().split(/\n\s*\n/).filter((b) => b.trim())
  return blocks.map((block, i) => {
    const lines = block.split('\n')
    if (lines.every((l) => /^\s*[-*] /.test(l))) {
      return (
        <ul key={i} className="list-disc pl-6 space-y-1 text-slate-900 text-base md:text-lg leading-relaxed">
          {lines.map((l, k) => <li key={k}><Inline text={l.replace(/^\s*[-*] /, '')} /></li>)}
        </ul>
      )
    }
    return (
      <p key={i} className="text-slate-900 text-base md:text-lg leading-relaxed whitespace-pre-wrap">
        {lines.map((l, k) => (
          <span key={k}>
            {/^\s*[-*] /.test(l) ? <>• <Inline text={l.replace(/^\s*[-*] /, '')} /></> : <Inline text={l} />}
            {k < lines.length - 1 && '\n'}
          </span>
        ))}
      </p>
    )
  })
}

function CodeBlock({ code }) {
  return (
    <pre className="overflow-x-auto rounded-2xl bg-slate-900 text-slate-100 text-sm leading-relaxed p-5 font-mono">
      <code>{code.replace(/\n$/, '')}</code>
    </pre>
  )
}

function useCountdown(endsAt) {
  const [left, setLeft] = useState(null)
  useEffect(() => {
    if (!endsAt) { setLeft(null); return }
    const tick = () => setLeft(Math.max(0, Math.round((new Date(endsAt).getTime() - Date.now()) / 1000)))
    tick()
    const t = setInterval(tick, 1000)
    return () => clearInterval(t)
  }, [endsAt])
  return left
}

const fmt = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`

// Integrity signals while a question is on screen: leaving the tab or the
// window, pasting and copying. Sent in small batches; the candidate is told
// about this before starting. They are notes for a person to review, never an
// automatic fail.
function useIntegrity(session, itemId) {
  const buf = useRef([])
  const itemRef = useRef(itemId)
  itemRef.current = itemId

  const flush = useCallback((beacon = false) => {
    if (!session || buf.current.length === 0) return
    const events = buf.current.splice(0, 50)
    const url = `/api/assessment/${session.id}/events`
    const body = JSON.stringify({ events, token: session.token || undefined })
    if (beacon && navigator.sendBeacon) {
      navigator.sendBeacon(url, new Blob([body], { type: 'application/json' }))
    } else {
      fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body, keepalive: true }).catch(() => {})
    }
  }, [session])

  useEffect(() => {
    if (!session || !itemId) return
    const push = (e) => buf.current.push({ ...e, itemId: itemRef.current })
    let hiddenAt = null
    let blurAt = null
    const onVis = () => {
      if (document.hidden) hiddenAt = Date.now()
      else if (hiddenAt) { push({ kind: 'tab_hidden', ms: Date.now() - hiddenAt }); hiddenAt = null }
    }
    const onBlur = () => { if (!document.hidden) blurAt = Date.now() }
    const onFocus = () => { if (blurAt) { push({ kind: 'window_blur', ms: Date.now() - blurAt }); blurAt = null } }
    const onPaste = (e) => push({ kind: 'paste', chars: (e.clipboardData?.getData('text') || '').length })
    const onCopy = () => push({ kind: 'copy', chars: String(window.getSelection?.() || '').length })
    const onHide = () => flush(true)
    document.addEventListener('visibilitychange', onVis)
    window.addEventListener('blur', onBlur)
    window.addEventListener('focus', onFocus)
    document.addEventListener('paste', onPaste)
    document.addEventListener('copy', onCopy)
    window.addEventListener('pagehide', onHide)
    const timer = setInterval(() => flush(), 15000)
    return () => {
      document.removeEventListener('visibilitychange', onVis)
      window.removeEventListener('blur', onBlur)
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('paste', onPaste)
      document.removeEventListener('copy', onCopy)
      window.removeEventListener('pagehide', onHide)
      clearInterval(timer)
    }
  }, [session, itemId, flush])

  return flush
}

export default function WrittenAssessment({ track = 'backend', level = null, jobId = null, allowedLanguages = null, returnTo = null }) {
  const [options, setOptions] = useState(null)
  const [chosenLevel, setChosenLevel] = useState(level || 'L3')
  const [language, setLanguage] = useState('')
  const [session, setSession] = useState(null)   // { id, token }
  const [state, setState] = useState(null)       // server state
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState(null)

  // Per-item drafts
  const [choice, setChoice] = useState(null)
  const [choices, setChoices] = useState([])
  const [text, setText] = useState('')
  const [code, setCode] = useState('')
  const [runResult, setRunResult] = useState(null)
  const shownAt = useRef(Date.now())
  const autoSubmitted = useRef(null)

  const api = useCallback(async (path, { method = 'GET', body } = {}) => {
    const res = await fetch(path, {
      method,
      headers: {
        'content-type': 'application/json',
        ...(session?.token ? { 'x-assessment-token': session.token } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) throw Object.assign(new Error(data.error || `Request failed (${res.status})`), { code: data.code, status: res.status })
    return data
  }, [session])

  // Options + resume after a page reload.
  useEffect(() => {
    fetch('/api/assessment/start').then((r) => r.json()).then((o) => {
      // A job may allow only some languages.
      const languages = allowedLanguages ? o.languages.filter((l) => allowedLanguages.includes(l.key)) : o.languages
      setOptions({ ...o, languages })
      if (languages?.length) setLanguage((l) => l || languages[0].key)
    }).catch(() => setError('Could not load the assessment. Please refresh.'))
    // Resume after a reload: a practice test needs its token; a job test is
    // reached through the candidate's own login.
    const saved = readStore()
    if (saved?.id && (saved.token || (jobId && saved.jobId === jobId))) setSession(saved)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!session || state) return
    api(`/api/assessment/${session.id}`).then(applyState).catch(() => { writeStore(null); setSession(null) })
  }, [session]) // eslint-disable-line react-hooks/exhaustive-deps

  function applyState(s) {
    if (s.result) setResult(s.result)
    setState((prev) => {
      if (s.item && s.item.id !== prev?.item?.id) {
        setChoice(null); setChoices([]); setText(''); setRunResult(null)
        setCode(s.item.type === 'coding' ? (s.item.starter || '') : '')
        shownAt.current = Date.now()
      }
      return s
    })
    if (s.status === 'completed') writeStore(null)
  }

  async function start() {
    setError(''); setBusy(true)
    try {
      const data = await fetch('/api/assessment/start', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ mode: 'written', track, level: chosenLevel, language, jobId }),
      }).then(async (r) => { const d = await r.json(); if (!r.ok) throw new Error(d.error || 'Could not start'); return d })
      const s = { id: data.sessionId, token: data.token || null, jobId }
      setSession(s); writeStore(s)
      applyState(data)
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  async function begin() {
    setError(''); setBusy(true)
    try { applyState(await api(`/api/assessment/${session.id}/begin`, { method: 'POST' })) }
    catch (e) { setError(e.message) }
    finally { setBusy(false) }
  }

  const left = useCountdown(state?.status === 'in_progress' ? state.sectionEndsAt : null)
  const flushIntegrity = useIntegrity(session, state?.status === 'in_progress' ? state.item?.id : null)

  const submit = useCallback(async ({ skip = false } = {}) => {
    const item = state?.item
    if (!item || busy) return
    let response
    if (skip) response = {}
    else if (item.type === 'mcq' || item.type === 'sjt') response = { choice }
    else if (item.type === 'multi_select') response = { choices }
    else if (item.type === 'coding') response = { code }
    else response = { text }
    setError(''); setBusy(true)
    flushIntegrity()
    try {
      const data = await api('/api/assessment/respond', {
        method: 'POST',
        body: { sessionId: session.id, itemId: item.id, response, timeSpentMs: Date.now() - shownAt.current },
      })
      if (data.notice === 'section_time_up') setError('Time ran out for that section, so the remaining questions in it were left unanswered.')
      applyState(data)
      if (data.status === 'completed' && !data.result) {
        applyState(await api(`/api/assessment/${session.id}`))
      }
    } catch (e) {
      if (e.status === 409) { applyState(await api(`/api/assessment/${session.id}`)); setError(e.message) }
      else setError(e.message)
    } finally {
      setBusy(false)
    }
  }, [state, busy, choice, choices, code, text, session, api, flushIntegrity])


  // When the section clock hits zero, hand in whatever is on screen.
  useEffect(() => {
    if (left === 0 && state?.item && autoSubmitted.current !== state.item.id) {
      autoSubmitted.current = state.item.id
      submit()
    }
  }, [left, state, submit])

  async function runExamples() {
    setBusy(true); setRunResult(null)
    try { setRunResult(await api(`/api/assessment/${session.id}/run`, { method: 'POST', body: { itemId: state.item.id, code } })) }
    catch (e) { setRunResult({ error: e.message }) }
    finally { setBusy(false) }
  }

  const item = state?.item
  const canSubmit = item && !busy && (
    ((item.type === 'mcq' || item.type === 'sjt') && choice != null) ||
    (item.type === 'multi_select' && choices.length > 0) ||
    (item.type === 'coding' && code.trim()) ||
    ((item.type === 'code_review' || item.type === 'scenario_response') && text.trim())
  )
  const card = 'bg-white border border-slate-200 rounded-[2.5rem] p-6 md:p-12 shadow-xl shadow-indigo-500/5'
  const primary = 'btn-style-9 group uppercase tracking-widest text-xs shadow-2xl !px-10 !py-4 rounded-full font-black disabled:opacity-60 disabled:cursor-not-allowed justify-center'
  const trackLabel = options?.tracks?.find((t) => t.key === track)?.label || track

  return (
    <div className="pb-10">
      <div className="container mx-auto max-w-3xl px-4">
        <div className="mb-8 text-center">
          <span className="inline-block px-4 py-1.5 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-600 font-black text-[10px] uppercase tracking-[0.4em] mb-4">
            Written Assessment
          </span>
          <h1 className="text-3xl md:text-5xl font-black tracking-tight uppercase text-slate-900">
            {trackLabel} · {LEVEL_LABELS[chosenLevel] || chosenLevel}
          </h1>
        </div>

        {error && <div className="mb-6 p-4 rounded-2xl border border-amber-200 bg-amber-50 text-amber-800 text-sm">{error}</div>}

        {!session && (
          <div className={card}>
            <div className="grid gap-6">
              <p className="text-slate-600 text-sm leading-relaxed">
                This assessment has a few timed sections: core knowledge, a coding task, a code review and
                real work situations. Each section has its own timer, which starts when you press Begin on
                that section. You cannot go back to a previous question. Use a computer for the coding part.
                If you need extra time for a disability or health reason, ask the company before you start.
              </p>
              <p className="text-slate-500 text-xs leading-relaxed">
                Please work on your own. During the test we note when you leave this page and when text is pasted
                or copied, and share these notes with the hiring team. They are not an automatic fail; the team may
                simply ask you about them.
              </p>
              <div className="grid sm:grid-cols-2 gap-4">
                {!level && (
                  <label className="grid gap-2 text-sm">
                    <span className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">Level</span>
                    <select value={chosenLevel} onChange={(e) => setChosenLevel(e.target.value)} className="rounded-xl border border-slate-300 px-4 py-3 bg-white">
                      {(options?.levels || []).map((l) => <option key={l.key} value={l.key}>{l.label}</option>)}
                    </select>
                  </label>
                )}
                <label className="grid gap-2 text-sm">
                  <span className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">Coding language</span>
                  <select value={language} onChange={(e) => setLanguage(e.target.value)} className="rounded-xl border border-slate-300 px-4 py-3 bg-white">
                    {(options?.languages || []).map((l) => <option key={l.key} value={l.key}>{l.label}</option>)}
                  </select>
                </label>
              </div>
              <button type="button" onClick={start} disabled={busy || !language} className={primary}>
                <div className="btn-shimmer"></div><span>{busy ? 'Preparing…' : 'Start assessment'}</span>
              </button>
            </div>
          </div>
        )}

        {state?.status === 'section_intro' && (
          <div className={card}>
            <p className="text-xs font-black uppercase tracking-[0.3em] text-slate-400 mb-3">
              Section {state.sectionIndex + 1} of {state.sections.length}
            </p>
            <h2 className="text-2xl md:text-3xl font-black text-slate-900 mb-4">{state.section.label}</h2>
            <p className="text-slate-600 mb-8">
              {state.section.count} {state.section.count === 1 ? 'question' : 'questions'} · {state.section.minutes} minutes.
              The timer starts when you press Begin.
            </p>
            <button type="button" onClick={begin} disabled={busy} className={primary}>
              <div className="btn-shimmer"></div><span>{busy ? 'Starting…' : 'Begin section'}</span>
            </button>
          </div>
        )}

        {state?.status === 'in_progress' && item && (
          <div className={card}>
            <div className="flex items-center justify-between mb-6 text-xs gap-3">
              <span className="font-black uppercase tracking-[0.2em] text-slate-500">
                {state.section.label} · {state.itemIndex + 1} of {state.section.count}
              </span>
              {left != null && (
                <span className={`font-mono tabular-nums text-sm px-3 py-1 rounded-full ${left <= 120 ? 'bg-red-50 text-red-600' : 'bg-slate-100 text-slate-700'}`}>
                  {fmt(left)}
                </span>
              )}
            </div>

            <RichText text={item.prompt} />

            {item.code && <div className="mt-6"><CodeBlock code={item.code} /></div>}

            {(item.type === 'mcq' || item.type === 'sjt' || item.type === 'multi_select') && (
              <div className="grid gap-3 mt-8">
                {item.choices.map((c, idx) => {
                  const multi = item.type === 'multi_select'
                  const on = multi ? choices.includes(idx) : choice === idx
                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => multi ? setChoices((cs) => cs.includes(idx) ? cs.filter((x) => x !== idx) : [...cs, idx]) : setChoice(idx)}
                      className={`text-left px-5 py-4 rounded-2xl border transition ${on ? 'border-indigo-500 bg-indigo-50 text-slate-900' : 'border-slate-300 text-slate-700 hover:border-slate-400'}`}
                    >
                      <span className="flex items-start gap-3">
                        <span className={`mt-0.5 w-5 h-5 ${multi ? 'rounded-md' : 'rounded-full'} border-2 flex-shrink-0 flex items-center justify-center ${on ? 'border-indigo-500 bg-indigo-500' : 'border-slate-300'}`}>
                          {on && <span className="w-2 h-2 rounded-full bg-white" />}
                        </span>
                        <span className="whitespace-pre-wrap">{c}</span>
                      </span>
                    </button>
                  )
                })}
              </div>
            )}

            {(item.type === 'code_review' || item.type === 'scenario_response') && (
              <textarea
                rows={10}
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder={item.type === 'code_review' ? 'List the problems, most serious first, and how you would fix each…' : 'Your answer…'}
                className="w-full mt-8 px-5 py-4 rounded-2xl border border-slate-300 bg-white text-slate-900 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none resize-y"
              />
            )}

            {item.type === 'coding' && (
              <div className="mt-8 grid gap-4">
                <textarea
                  rows={18}
                  value={code}
                  spellCheck={false}
                  onChange={(e) => setCode(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key !== 'Tab') return
                    e.preventDefault()
                    const el = e.currentTarget
                    const { selectionStart: a, selectionEnd: b } = el
                    const next = code.slice(0, a) + '  ' + code.slice(b)
                    setCode(next)
                    requestAnimationFrame(() => { el.selectionStart = el.selectionEnd = a + 2 })
                  }}
                  className="w-full px-5 py-4 rounded-2xl border border-slate-300 bg-slate-950 text-slate-100 font-mono text-sm leading-relaxed focus:border-indigo-500 outline-none resize-y"
                />
                <div className="flex flex-wrap items-center gap-3">
                  <button type="button" onClick={runExamples} disabled={busy || !code.trim()} className="px-5 py-3 rounded-full border border-slate-300 text-xs font-black uppercase tracking-widest text-slate-700 hover:border-slate-400 disabled:opacity-50">
                    Run examples
                  </button>
                  <span className="text-xs text-slate-500">
                    Runs the {item.visibleTests?.length || 0} examples only. Your answer is also checked against hidden tests.
                  </span>
                </div>
                {runResult && (
                  <div className="rounded-2xl border border-slate-200 p-4 text-sm grid gap-3">
                    {runResult.error && <p className="text-amber-700">{runResult.error}</p>}
                    {(runResult.results || []).map((r, i) => (
                      <div key={i} className="grid gap-1">
                        <p className={`font-bold ${r.passed ? 'text-emerald-600' : 'text-red-600'}`}>{r.passed ? '✓' : '✗'} {r.name}</p>
                        {!r.passed && (
                          <p className="font-mono text-xs text-slate-600 whitespace-pre-wrap">
                            {r.error ? r.error : `expected ${JSON.stringify(r.expected)}\n     got ${JSON.stringify(r.actual)}`}
                          </p>
                        )}
                        {r.logs?.length > 0 && <pre className="font-mono text-xs bg-slate-50 rounded-lg p-2 overflow-x-auto">{r.logs.join('\n')}</pre>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="mt-8 flex flex-wrap items-center gap-4">
              <button type="button" onClick={() => submit()} disabled={!canSubmit} className={primary}>
                <div className="btn-shimmer"></div><span>{busy ? 'Saving…' : 'Submit answer'}</span>
              </button>
              <button type="button" onClick={() => submit({ skip: true })} disabled={busy} className="text-xs font-bold uppercase tracking-widest text-slate-400 hover:text-slate-600">
                Skip question
              </button>
            </div>
          </div>
        )}

        {state?.status === 'completed' && (
          <div className={card}>
            <div className="text-center mb-8">
              <span className="inline-block px-4 py-1.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-600 font-black text-[10px] uppercase tracking-[0.4em] mb-3">
                Assessment complete
              </span>
              <h2 className="text-2xl md:text-3xl font-black text-slate-900">Thank you</h2>
              <p className="text-slate-500 mt-3 text-sm">Your answers have been submitted to the hiring team.</p>
            </div>
            {result?.sections?.length > 0 && (
              <div className="grid gap-3">
                {result.sections.map((s) => (
                  <div key={s.label} className="flex items-center justify-between rounded-2xl border border-slate-200 px-5 py-4 text-sm">
                    <span className="font-bold text-slate-800">{s.label}</span>
                    <span className="text-slate-500">{s.feedback}</span>
                  </div>
                ))}
              </div>
            )}
            {returnTo && (
              <div className="mt-10 text-center">
                <a href={returnTo} className={primary}><div className="btn-shimmer"></div><span>Back to application →</span></a>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
