'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

// Candidate flow for the written assessment (frameworks/swe-assessment-design.md):
// intake -> section intro -> items (timed per section) -> ... -> finished.
// The server owns the timer, the order and the scoring; this component only
// shows what /api/assessment/* returns and sends answers back.

const LEVEL_LABELS = { L2: 'Junior', L3: 'Mid', L4: 'Senior', L5: 'Lead', staff: 'Staff', manager: 'Manager', agent: 'Agent', screener: 'Screener', full: 'Full' }

// ── Audio helpers (English test) ──────────────────────────────────────────

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(String(r.result).split(',')[1] || '')
    r.onerror = reject
    r.readAsDataURL(blob)
  })
}

// Records from the microphone for up to maxSeconds.
function useRecorder() {
  const rec = useRef(null)
  const [recording, setRecording] = useState(false)
  const [result, setResult] = useState(null) // { blob, mime, durationMs }
  const [left, setLeft] = useState(null)
  const start = useCallback(async (maxSeconds) => {
    setResult(null)
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    const mime = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'].find((m) => window.MediaRecorder?.isTypeSupported?.(m)) || ''
    const mr = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined)
    const chunks = []
    const startedAt = Date.now()
    mr.ondataavailable = (e) => e.data.size && chunks.push(e.data)
    mr.onstop = () => {
      stream.getTracks().forEach((t) => t.stop())
      clearInterval(rec.current?.timer)
      setRecording(false)
      setLeft(null)
      setResult({ blob: new Blob(chunks, { type: mr.mimeType || 'audio/webm' }), mime: mr.mimeType || 'audio/webm', durationMs: Date.now() - startedAt })
    }
    mr.start()
    setRecording(true)
    setLeft(maxSeconds)
    const timer = setInterval(() => {
      const remaining = Math.max(0, maxSeconds - Math.floor((Date.now() - startedAt) / 1000))
      setLeft(remaining)
      if (remaining === 0 && mr.state === 'recording') mr.stop()
    }, 250)
    rec.current = { mr, timer }
  }, [])
  const stop = useCallback(() => { if (rec.current?.mr?.state === 'recording') rec.current.mr.stop() }, [])
  const reset = useCallback(() => setResult(null), [])
  return { start, stop, reset, recording, result, left }
}

// Plays the current item's audio (fetched with the session token; the script
// never reaches the browser). Returns when playback ends.
function useItemAudio(session, itemId, plays) {
  const [left, setLeft] = useState(plays)
  const [playing, setPlaying] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => { setLeft(plays); setError('') }, [itemId, plays])
  const play = useCallback(async () => {
    setError('')
    const res = await fetch(`/api/assessment/${session.id}/audio?itemId=${itemId}`, {
      headers: session.token ? { 'x-assessment-token': session.token } : {},
    })
    if (!res.ok) {
      const d = await res.json().catch(() => ({}))
      setError(d.error || 'Could not play the audio')
      if (res.status === 429) setLeft(0)
      return false
    }
    setLeft(Number(res.headers.get('X-Plays-Left') ?? 0))
    const url = URL.createObjectURL(await res.blob())
    const audio = new Audio(url)
    setPlaying(true)
    await new Promise((resolve) => { audio.onended = resolve; audio.onerror = resolve; audio.play().catch(resolve) })
    setPlaying(false)
    URL.revokeObjectURL(url)
    return true
  }, [session, itemId])
  return { play, left, playing, error }
}

function PlayButton({ audio, label = 'Play' }) {
  return (
    <div className="flex items-center gap-3">
      <button type="button" onClick={audio.play} disabled={audio.playing || audio.left <= 0}
        className="px-5 py-3 rounded-full bg-indigo-600 text-white text-xs font-black uppercase tracking-widest disabled:opacity-50">
        {audio.playing ? 'Playing…' : `▶ ${label}`}
      </button>
      <span className="text-xs text-slate-500">{audio.left > 0 ? `${audio.left} play${audio.left === 1 ? '' : 's'} left` : 'No plays left'}</span>
      {audio.error && <span className="text-xs text-amber-700">{audio.error}</span>}
    </div>
  )
}

// Microphone check before the English test (not scored, not stored).
function SoundCheck({ session, onPassed }) {
  const recorder = useRecorder()
  const [status, setStatus] = useState(null)
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    if (!recorder.result) return
    ;(async () => {
      setBusy(true)
      try {
        const res = await fetch(`/api/assessment/${session.id}/sound-check`, {
          method: 'POST',
          headers: { 'content-type': 'application/json', ...(session.token ? { 'x-assessment-token': session.token } : {}) },
          body: JSON.stringify({ audio: await blobToBase64(recorder.result.blob), mime: recorder.result.mime }),
        })
        const d = await res.json()
        setStatus(d)
        if (d.ok) onPassed()
      } catch {
        setStatus({ ok: false, heard: '' })
      } finally {
        setBusy(false)
      }
    })()
  }, [recorder.result]) // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="rounded-2xl border border-slate-200 p-5 mb-6 grid gap-3">
      <p className="text-sm font-bold text-slate-800">Microphone check</p>
      <p className="text-sm text-slate-600">Press the button and say: <em>"Hello, my name is … and I am ready to start the test."</em></p>
      <div className="flex items-center gap-3">
        <button type="button" disabled={recorder.recording || busy} onClick={() => recorder.start(6).catch(() => setStatus({ ok: false, heard: '', denied: true }))}
          className="px-5 py-3 rounded-full border border-slate-300 text-xs font-black uppercase tracking-widest text-slate-700 disabled:opacity-50">
          {recorder.recording ? `Recording… ${recorder.left}s` : busy ? 'Checking…' : '🎙 Test my microphone'}
        </button>
      </div>
      {status && (status.ok
        ? <p className="text-sm text-emerald-700">✓ We heard you clearly: "{status.heard}"</p>
        : <p className="text-sm text-amber-700">{status.denied ? 'Please allow microphone access in your browser, then try again.' : `We could not hear enough${status.heard ? ` (heard: "${status.heard}")` : ''}. Move somewhere quieter or closer to the microphone and try again.`}</p>)}
    </div>
  )
}

// One speaking task: optional prompt audio, a short preparation countdown,
// then recording (stops by itself at the time limit), one re-record allowed.
function SpeakingTask({ item, session, onReady }) {
  const audio = useItemAudio(session, item.id, item.plays || 1)
  const recorder = useRecorder()
  const [phase, setPhase] = useState(item.hasPromptAudio ? 'listen' : 'prep')
  const [prepLeft, setPrepLeft] = useState(item.prepSeconds || 0)
  const [rerecords, setRerecords] = useState(0)
  const [micError, setMicError] = useState('')

  const startRecording = useCallback(() => {
    setPhase('record')
    recorder.start(item.maxSeconds || 30).catch(() => setMicError('Please allow microphone access, then try again.'))
  }, [recorder, item.maxSeconds])

  useEffect(() => {
    if (phase !== 'prep') return
    if (!prepLeft) { startRecording(); return }
    const t = setTimeout(() => setPrepLeft((x) => x - 1), 1000)
    return () => clearTimeout(t)
  }, [phase, prepLeft, startRecording])

  useEffect(() => {
    if (recorder.result) onReady({ ...recorder.result, rerecords })
  }, [recorder.result]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="mt-6 grid gap-4">
      {item.text && <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 text-slate-800 text-lg leading-relaxed">{item.text}</div>}
      {phase === 'listen' && (
        <PlayButton audio={{ ...audio, play: async () => { if (await audio.play()) setPhase('prep') } }} label="Play" />
      )}
      {phase === 'prep' && <p className="text-sm text-slate-600">Get ready… recording starts in <b>{prepLeft}s</b></p>}
      {phase === 'record' && recorder.recording && (
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center gap-2 text-sm font-bold text-red-600"><span className="w-2.5 h-2.5 rounded-full bg-red-600 animate-pulse" /> Recording… {recorder.left}s</span>
          <button type="button" onClick={recorder.stop} className="px-4 py-2 rounded-full border border-slate-300 text-xs font-black uppercase tracking-widest">Stop</button>
        </div>
      )}
      {recorder.result && !recorder.recording && (
        <div className="flex items-center gap-3 text-sm">
          <span className="text-emerald-700">✓ Recorded {Math.round(recorder.result.durationMs / 1000)}s</span>
          {rerecords < 1 && (
            <button type="button" onClick={() => { setRerecords((n) => n + 1); recorder.reset(); onReady(null); startRecording() }}
              className="text-xs font-bold uppercase tracking-widest text-slate-500 hover:text-slate-700">Re-record (once)</button>
          )}
        </div>
      )}
      {micError && <p className="text-sm text-amber-700">{micError}</p>}
    </div>
  )
}

// Typing test: the passage on top, a box below. The 2-minute timer starts at
// the first key press; pasting is blocked and counted; the gaps between key
// presses are summarised (very regular sub-15 ms gaps suggest an auto-typer).
function TypingTask({ item, onDone, disabled, resultRef }) {
  const [typed, setTyped] = useState('')
  const [startedAt, setStartedAt] = useState(null)
  const [left, setLeft] = useState(item.seconds || 120)
  const keys = useRef({ last: null, intervals: [], pastes: 0 })
  const doneRef = useRef(false)

  const snapshot = useCallback(() => {
    const iv = keys.current.intervals
    const mean = iv.length ? iv.reduce((a, b) => a + b, 0) / iv.length : null
    return {
      typed,
      elapsedMs: startedAt ? Math.min(Date.now() - startedAt, (item.seconds || 120) * 1000) : 0,
      pasteAttempts: keys.current.pastes,
      stats: { keystrokes: iv.length + (iv.length ? 1 : 0), fastShare: iv.length ? iv.filter((x) => x < 15).length / iv.length : 0, meanMs: mean },
    }
  }, [typed, startedAt, item.seconds])
  resultRef.current = snapshot

  useEffect(() => {
    if (!startedAt) return
    const t = setInterval(() => {
      const remaining = Math.max(0, (item.seconds || 120) - Math.floor((Date.now() - startedAt) / 1000))
      setLeft(remaining)
      if (remaining === 0 && !doneRef.current) { doneRef.current = true; onDone() }
    }, 250)
    return () => clearInterval(t)
  }, [startedAt, item.seconds, onDone])

  return (
    <div className="mt-6 grid gap-4">
      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 text-slate-800 leading-relaxed select-none" onCopy={(e) => e.preventDefault()}>
        {item.passage}
      </div>
      <div className="flex items-center justify-between text-xs text-slate-500">
        <span>{startedAt ? 'Keep typing…' : 'The timer starts when you press the first key.'}</span>
        <span className={`font-mono tabular-nums text-sm px-3 py-1 rounded-full ${left <= 15 ? 'bg-red-50 text-red-600' : 'bg-slate-100 text-slate-700'}`}>{fmt(left)}</span>
      </div>
      <textarea
        rows={8}
        value={typed}
        disabled={disabled || left === 0}
        spellCheck={false}
        autoCorrect="off"
        autoCapitalize="off"
        onPaste={(e) => { e.preventDefault(); keys.current.pastes += 1 }}
        onDrop={(e) => e.preventDefault()}
        onKeyDown={() => {
          const now = performance.now()
          if (!startedAt) setStartedAt(Date.now())
          if (keys.current.last != null && keys.current.intervals.length < 5000) keys.current.intervals.push(now - keys.current.last)
          keys.current.last = now
        }}
        onChange={(e) => setTyped(e.target.value)}
        placeholder="Start typing the text above here…"
        className="w-full px-5 py-4 rounded-2xl border border-slate-300 bg-white text-slate-900 focus:border-indigo-500 outline-none resize-y"
      />
    </div>
  )
}
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

// Integrity while a question is on screen. Copying question text out, pasting
// text from outside the test, and dragging text in or out are blocked. Copying
// and pasting within the candidate's own answers still works (moving their own
// code around). Blocked attempts and leaving the tab or window are sent in
// small batches as notes for a person to review, never an automatic fail; the
// candidate is told about this before starting.
const answerFieldOf = (el) => (el && el.closest ? el.closest('textarea, input') : null)

function selectedText(field) {
  if (field && typeof field.selectionStart === 'number') return field.value.slice(field.selectionStart, field.selectionEnd)
  return String(window.getSelection?.() || '')
}

const sameText = (a, b) => a.replace(/\r\n/g, '\n') === b.replace(/\r\n/g, '\n')

function useIntegrity(session, itemId, onBlocked) {
  const buf = useRef([])
  const itemRef = useRef(itemId)
  itemRef.current = itemId
  const ownClip = useRef('')
  const onBlockedRef = useRef(onBlocked)
  onBlockedRef.current = onBlocked
  // Characters seen being typed (or pasted back from the candidate's own
  // answer) on this question. The report compares it with how much the answer
  // grew: text that appears without typing came from a tool, not the keyboard.
  const typedChars = useRef(0)
  useEffect(() => { typedChars.current = 0 }, [itemId])
  const record = useCallback((e) => buf.current.push({ ...e, itemId: itemRef.current }), [])

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
    const blocked = (message) => onBlockedRef.current?.(message)
    const preventDefault = (e) => e.preventDefault()
    let hiddenAt = null
    let blurAt = null
    const onVis = () => {
      if (document.hidden) hiddenAt = Date.now()
      else if (hiddenAt) { push({ kind: 'tab_hidden', ms: Date.now() - hiddenAt }); hiddenAt = null }
    }
    const onBlur = () => { if (!document.hidden) blurAt = Date.now() }
    const onFocus = () => { if (blurAt) { push({ kind: 'window_blur', ms: Date.now() - blurAt }); blurAt = null } }
    // Copy or cut: allowed only from the candidate's own answer, and remembered
    // so that text can be pasted back. Anything else (the question, the
    // options, code shown for review) cannot be copied out.
    const onCopy = (e) => {
      const field = answerFieldOf(e.target)
      if (field) { ownClip.current = selectedText(field); return }
      e.preventDefault()
      push({ kind: 'copy_blocked', chars: selectedText(null).length })
      blocked('Copying the questions is turned off during the test.')
    }
    // Paste: allowed only when it is text the candidate copied from their own
    // answer in this test. (The typing test blocks every paste itself.)
    const onPaste = (e) => {
      if (e.defaultPrevented) return
      const pasted = e.clipboardData?.getData('text') || ''
      if (answerFieldOf(e.target) && ownClip.current && sameText(pasted, ownClip.current)) {
        typedChars.current += pasted.length
        return
      }
      e.preventDefault()
      push({ kind: 'paste_blocked', chars: pasted.length })
      blocked('Pasting from outside the test is turned off. Please type your answer.')
    }
    const onDrop = (e) => {
      e.preventDefault()
      push({ kind: 'drop_blocked', chars: (e.dataTransfer?.getData('text') || '').length })
      blocked('Dragging text into the test is turned off. Please type your answer.')
    }
    const onDragStart = (e) => { if (!answerFieldOf(e.target)) e.preventDefault() }
    const onInput = (e) => {
      if (!answerFieldOf(e.target)) return
      const t = e.inputType || ''
      if (t === 'insertText' || t === 'insertCompositionText' || t === 'insertReplacementText') typedChars.current += (e.data || '').length
      else if (t === 'insertLineBreak' || t === 'insertParagraph') typedChars.current += 1
    }
    const onHide = () => flush(true)
    document.addEventListener('visibilitychange', onVis)
    window.addEventListener('blur', onBlur)
    window.addEventListener('focus', onFocus)
    document.addEventListener('paste', onPaste)
    document.addEventListener('copy', onCopy)
    document.addEventListener('cut', onCopy)
    document.addEventListener('drop', onDrop)
    document.addEventListener('dragover', preventDefault)
    document.addEventListener('dragstart', onDragStart)
    document.addEventListener('input', onInput)
    window.addEventListener('pagehide', onHide)
    const timer = setInterval(() => flush(), 15000)
    return () => {
      document.removeEventListener('visibilitychange', onVis)
      window.removeEventListener('blur', onBlur)
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('paste', onPaste)
      document.removeEventListener('copy', onCopy)
      document.removeEventListener('cut', onCopy)
      document.removeEventListener('drop', onDrop)
      document.removeEventListener('dragover', preventDefault)
      document.removeEventListener('dragstart', onDragStart)
      document.removeEventListener('input', onInput)
      window.removeEventListener('pagehide', onHide)
      clearInterval(timer)
    }
  }, [session, itemId, flush])

  return [flush, () => typedChars.current, record]
}

// Full screen while questions are on screen (as HackerRank and TestGorilla
// do). Leaving it covers the question until the candidate returns; each exit
// and the time away are noted for review. Browsers without full screen (for
// example iPhone Safari), or that refuse it, are never locked out: the test
// carries on and the report says full screen was not available.
const fsElement = () => document.fullscreenElement || document.webkitFullscreenElement || null
const fsSupported = () => Boolean(document.fullscreenEnabled || document.webkitFullscreenEnabled)

function leaveFullscreen() {
  if (typeof document === 'undefined' || !fsElement()) return
  const exit = document.exitFullscreen || document.webkitExitFullscreen
  try { Promise.resolve(exit.call(document)).catch(() => {}) } catch {}
}

function useFullscreenGuard(active, record) {
  const [, rerender] = useState(0)
  const [pending, setPending] = useState(false)
  const [unavailable, setUnavailable] = useState(false)
  const outAt = useRef(null)
  const noted = useRef(false)
  const markUnavailable = useCallback(() => {
    setUnavailable(true)
    if (!noted.current) { noted.current = true; record({ kind: 'fullscreen_unavailable' }) }
  }, [record])

  // Must be called from a click (browsers only allow full screen then).
  const enter = useCallback(() => {
    if (typeof document === 'undefined' || fsElement()) return
    if (!fsSupported()) { markUnavailable(); return }
    const el = document.documentElement
    const request = el.requestFullscreen || el.webkitRequestFullscreen
    setPending(true)
    let p
    try { p = Promise.resolve(request.call(el)) } catch (e) { p = Promise.reject(e) }
    p.catch(markUnavailable).finally(() => { setPending(false); rerender((n) => n + 1) })
  }, [markUnavailable])

  useEffect(() => {
    if (!active) return
    if (!fsSupported()) { markUnavailable(); return }
    // Only real changes count: a page reload shows the cover without noting an exit.
    const onChange = () => {
      const full = Boolean(fsElement())
      if (!full && outAt.current == null) { outAt.current = Date.now(); record({ kind: 'fullscreen_exit' }) }
      else if (full && outAt.current != null) { record({ kind: 'fullscreen_back', ms: Date.now() - outAt.current }); outAt.current = null }
      rerender((n) => n + 1)
    }
    document.addEventListener('fullscreenchange', onChange)
    document.addEventListener('webkitfullscreenchange', onChange)
    return () => {
      document.removeEventListener('fullscreenchange', onChange)
      document.removeEventListener('webkitfullscreenchange', onChange)
    }
  }, [active, record, markUnavailable])

  const blocked = active && !unavailable && !pending && typeof document !== 'undefined' && fsSupported() && !fsElement()
  return { blocked, enter }
}

export default function WrittenAssessment({ track = 'backend', level = null, jobId = null, allowedLanguages = null, options: testOptions = {}, returnTo = null }) {
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
  const typingRef = useRef(null)
  const [spoken, setSpoken] = useState(null)
  const [soundOk, setSoundOk] = useState(false)
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
    fetch(`/api/assessment/start?track=${encodeURIComponent(track)}&level=${encodeURIComponent(level || 'L3')}`).then((r) => r.json()).then((o) => {
      // The track decides which languages make sense (no Python for Frontend),
      // and a job may narrow that further.
      const trackLangs = o.tracks?.find((t) => t.key === track)?.languages
      const languages = o.languages
        .filter((l) => !trackLangs || trackLangs.includes(l.key))
        .filter((l) => !allowedLanguages || allowedLanguages.includes(l.key))
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
        setChoice(null); setChoices([]); setText(''); setRunResult(null); setSpoken(null)
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
        body: JSON.stringify({ mode: 'written', track, level: chosenLevel, language: usesCode ? language : null, jobId, options: testOptions }),
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
    fullscreen.enter() // before any await: it needs the click
    setError(''); setBusy(true)
    try { applyState(await api(`/api/assessment/${session.id}/begin`, { method: 'POST' })) }
    catch (e) { setError(e.message) }
    finally { setBusy(false) }
  }

  const left = useCountdown(state?.status === 'in_progress' ? state.sectionEndsAt : null)
  const [blockedNotice, setBlockedNotice] = useState('')
  const noticeTimer = useRef(null)
  const showBlocked = useCallback((message) => {
    setBlockedNotice(message)
    clearTimeout(noticeTimer.current)
    noticeTimer.current = setTimeout(() => setBlockedNotice(''), 4000)
  }, [])
  useEffect(() => () => clearTimeout(noticeTimer.current), [])
  const [flushIntegrity, typedChars, recordIntegrity] = useIntegrity(session, state?.status === 'in_progress' ? state.item?.id : null, showBlocked)
  const fullscreen = useFullscreenGuard(state?.status === 'in_progress' && Boolean(state?.item), recordIntegrity)
  useEffect(() => { if (state?.status === 'completed') leaveFullscreen() }, [state?.status])

  const submit = useCallback(async ({ skip = false } = {}) => {
    const item = state?.item
    if (!item || busy) return
    let response
    if (skip) response = {}
    else if (item.type === 'mcq' || item.type === 'sjt' || item.type === 'listening') response = { choice }
    else if (item.type === 'speaking') response = spoken ? { audio: await blobToBase64(spoken.blob), mime: spoken.mime, durationMs: spoken.durationMs, rerecords: spoken.rerecords } : {}
    else if (item.type === 'multi_select') response = { choices }
    else if (item.type === 'coding') response = { code, typed: { chars: typedChars(), growth: Math.max(0, code.length - (item.starter || '').length) } }
    else if (item.type === 'typing') response = typingRef.current ? typingRef.current() : {}
    else response = { text, typed: { chars: typedChars(), growth: text.length } }
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
  }, [state, busy, choice, choices, code, text, spoken, session, api, flushIntegrity])


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
  const usesCode = options?.preview ? options.preview.usesCode : true
  const wordCount = text.trim() ? text.trim().split(/\s+/).length : 0
  const canSubmit = item && !busy && (
    item.type === 'typing' ||
    (item.type === 'listening' && choice != null) ||
    (item.type === 'speaking' && spoken) ||
    ((item.type === 'mcq' || item.type === 'sjt') && choice != null) ||
    (item.type === 'multi_select' && choices.length > 0) ||
    (item.type === 'coding' && code.trim()) ||
    ((item.type === 'code_review' || item.type === 'scenario_response') && text.trim())
  )
  const card = 'bg-white border border-slate-200 rounded-[2.5rem] p-6 md:p-12 shadow-xl shadow-indigo-500/5'
  const primary = 'btn-style-9 group uppercase tracking-widest text-xs shadow-2xl !px-10 !py-4 rounded-full font-black disabled:opacity-60 disabled:cursor-not-allowed justify-center'
  const trackLabel = options?.tracks?.find((t) => t.key === track)?.label || track
  const preview = options?.preview

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
        {fullscreen.blocked && (
          <div className="fixed inset-0 z-[60] bg-white flex items-center justify-center p-6">
            <div className="max-w-md text-center">
              <h2 className="text-2xl md:text-3xl font-black text-slate-900 mb-4">Return to full screen</h2>
              <p className="text-slate-600 mb-8">
                The test runs in full screen. The question is hidden until you return, and the timer keeps running.
                Leaving full screen is noted for the hiring team.
              </p>
              <button type="button" onClick={fullscreen.enter} className={primary}>
                <div className="btn-shimmer"></div><span>Return to full screen</span>
              </button>
            </div>
          </div>
        )}
        {blockedNotice && (
          <div role="status" aria-live="polite" className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-[calc(100%-2rem)] max-w-md px-5 py-3 rounded-2xl border border-amber-200 bg-amber-50 text-amber-800 text-sm text-center shadow-lg">
            {blockedNotice}
          </div>
        )}

        {!session && (
          <div className={card}>
            <div className="grid gap-6">
              <p className="text-slate-600 text-sm leading-relaxed">
                {preview
                  ? `This assessment takes about ${preview.totalMinutes} minutes and has ${preview.sections.length} timed sections: ${preview.sections.map((x) => `${x.label.toLowerCase()} (${x.minutes} min)`).join(', ')}. `
                  : 'This assessment has a few timed sections. '}
                Each section has its own timer, which starts when you press Begin on that section. You cannot go
                back to a previous question.{usesCode ? ' Use a computer for the coding part.' : ''} If you need
                extra time for a disability or health reason, ask the company before you start.
              </p>
              {track === 'english' && (
                <p className="text-slate-600 text-sm leading-relaxed">
                  You will need a microphone and a quiet place. Some answers are spoken and recorded. Your accent is
                  not scored, only whether you are easy to understand. Recordings are shared with the hiring team and
                  deleted after 90 days. By starting you agree to being recorded. If you cannot use a microphone, ask
                  the company for the written version.
                </p>
              )}
              <p className="text-slate-500 text-xs leading-relaxed">
                Please work on your own. The test runs in full screen. Copying the questions and pasting text from
                outside the test are turned off (you can still copy and paste within your own answer). We note when
                you leave full screen or this page, or try to paste, and share these notes with the hiring team. They
                are not an automatic fail; the team may simply ask you about them.
              </p>
              <div className="grid sm:grid-cols-2 gap-4">
                {!level && (
                  <label className="grid gap-2 text-sm">
                    <span className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500">Level</span>
                    <select value={chosenLevel} onChange={(e) => setChosenLevel(e.target.value)} className="rounded-xl border border-slate-300 px-4 py-3 bg-white">
                      {(options?.levels || []).map((l) => <option key={l.key} value={l.key}>{l.label}</option>)}
                    </select>
                  </label>
                )}
                {usesCode && (
                  <label className="grid gap-2 text-sm">
                    <span className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500">Coding language</span>
                    <select value={language} onChange={(e) => setLanguage(e.target.value)} className="rounded-xl border border-slate-300 px-4 py-3 bg-white">
                      {(options?.languages || []).map((l) => <option key={l.key} value={l.key}>{l.label}</option>)}
                    </select>
                  </label>
                )}
              </div>
              <button type="button" onClick={start} disabled={busy || !options || (usesCode && !language)} className={primary}>
                <div className="btn-shimmer"></div><span>{busy ? 'Preparing…' : 'Start assessment'}</span>
              </button>
            </div>
          </div>
        )}

        {state?.status === 'section_intro' && (
          <div className={card}>
            <p className="text-xs font-black uppercase tracking-[0.3em] text-slate-500 mb-3">
              Section {state.sectionIndex + 1} of {state.sections.length}
            </p>
            <h2 className="text-2xl md:text-3xl font-black text-slate-900 mb-4">{state.section.label}</h2>
            <p className="text-slate-600 mb-8">
              {state.section.count} {state.section.count === 1 ? 'question' : 'questions'} · {state.section.minutes} minutes.
              The timer starts when you press Begin.
            </p>
            {track === 'english' && state.sectionIndex === 0 && !soundOk && (
              <SoundCheck session={session} onPassed={() => setSoundOk(true)} />
            )}
            <button type="button" onClick={begin} disabled={busy || (track === 'english' && state.sectionIndex === 0 && !soundOk)} className={primary}>
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

            {item.type === 'listening' && <div className="mt-6"><ListeningPlayer session={session} item={item} /></div>}

            {item.type === 'speaking' && <SpeakingTask key={item.id} item={item} session={session} onReady={setSpoken} />}

            {(item.type === 'mcq' || item.type === 'sjt' || item.type === 'multi_select' || item.type === 'listening') && (
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
              <>
                <textarea
                  rows={10}
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder={item.type === 'code_review' ? 'List the problems, most serious first, and how you would fix each…' : 'Write your answer here…'}
                  className="w-full mt-8 px-5 py-4 rounded-2xl border border-slate-300 bg-white text-slate-900 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none resize-y"
                />
                {item.minWords && (
                  <p className={`text-xs mt-2 ${wordCount < item.minWords || wordCount > item.maxWords ? 'text-amber-700' : 'text-slate-500'}`}>
                    {wordCount} words (aim for {item.minWords} to {item.maxWords})
                  </p>
                )}
              </>
            )}

            {item.type === 'typing' && (
              <TypingTask key={item.id} item={item} disabled={busy} resultRef={typingRef} onDone={() => submit()} />
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
              <button type="button" onClick={() => submit({ skip: true })} disabled={busy} className="text-xs font-bold uppercase tracking-widest text-slate-500 hover:text-slate-600">
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

function ListeningPlayer({ session, item }) {
  const audio = useItemAudio(session, item.id, item.plays || 2)
  return <PlayButton audio={audio} label="Play the recording" />
}
