'use client'

import { useEffect, useRef, useState } from 'react'
import { primeTTS, getAudioContext } from '@/lib/tts'
import { playServerTTS, stopServerTTS } from '@/lib/tts-client'
import { AI_NAME } from '@/lib/ai-config'

// ms of silence after last transcribed word before auto-submitting
const SILENCE_MS = 2200

// Programmatic chimes — reuses the shared AudioContext primed by primeTTS()
function playChime(notes) {
  const ctx = getAudioContext()
  if (!ctx) return
  if (ctx.state === 'suspended') ctx.resume().catch(() => {})
  try {
    const t0 = ctx.currentTime
    for (const [freq, dur, delay] of notes) {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.value = freq
      const start = t0 + (delay || 0)
      gain.gain.setValueAtTime(0.0001, start)
      gain.gain.exponentialRampToValueAtTime(0.22, start + 0.03)
      gain.gain.exponentialRampToValueAtTime(0.0001, start + dur)
      osc.connect(gain).connect(ctx.destination)
      osc.start(start)
      osc.stop(start + dur + 0.05)
    }
  } catch (e) {
    console.warn('chime failed:', e)
  }
}

function startChime() {
  // Rising 3-note: C5 → E5 → G5
  playChime([
    [523.25, 0.18, 0],
    [659.25, 0.18, 0.15],
    [783.99, 0.32, 0.3],
  ])
}

function endChime() {
  // Falling 3-note: G5 → E5 → C5
  playChime([
    [783.99, 0.18, 0],
    [659.25, 0.18, 0.18],
    [523.25, 0.4, 0.36],
  ])
}

/**
 * Hands-free voice Q&A.
 *
 * Props:
 *  - messages, loading, finishing, streamingQuestion, onSubmit, totalQuestions
 */
export default function VoiceChat({ messages, loading, finishing, streamingQuestion = '', onSubmit, totalQuestions }) {
  const [supported, setSupported] = useState(true)
  const [speaking, setSpeaking] = useState(false)
  const [listening, setListening] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [interim, setInterim] = useState('')
  const [permissionError, setPermissionError] = useState('')
  const [hasStarted, setHasStarted] = useState(false)

  const recognitionRef = useRef(null)
  const spokenIdsRef = useRef(new Set())
  const transcriptRef = useRef('')
  const silenceTimerRef = useRef(null)
  const submittedRef = useRef(false)
  const endChimedRef = useRef(false)

  const answeredCount = messages.filter((m) => m.role === 'user').length
  const lastAssistant = [...messages].reverse().find((m) => m.role === 'assistant')

  // ---- Init recognition once ----
  useEffect(() => {
    if (typeof window === 'undefined') return
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SR || !window.speechSynthesis) {
      setSupported(false)
      return
    }
    const rec = new SR()
    rec.continuous = true
    rec.interimResults = true
    rec.lang = 'en-US'

    rec.onresult = (event) => {
      let interimText = ''
      let finalAddition = ''
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const piece = event.results[i][0].transcript
        if (event.results[i].isFinal) finalAddition += piece + ' '
        else interimText += piece
      }
      if (finalAddition) {
        transcriptRef.current = (transcriptRef.current + ' ' + finalAddition).replace(/\s+/g, ' ').trim()
        setTranscript(transcriptRef.current)
      }
      setInterim(interimText)
      // Reset silence timer on ANY new speech activity (interim or final)
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current)
      const hasContent = (transcriptRef.current.length + interimText.length) > 0
      if (hasContent) {
        silenceTimerRef.current = setTimeout(() => {
          autoSubmit()
        }, SILENCE_MS)
      }
    }
    rec.onerror = (e) => {
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
        setPermissionError('Microphone permission was denied. Allow mic access and reload.')
        setListening(false)
      } else if (e.error !== 'no-speech' && e.error !== 'aborted') {
        console.warn('Speech recognition error:', e.error)
      }
    }
    rec.onend = () => {
      setListening(false)
      setInterim('')
    }

    recognitionRef.current = rec
    return () => {
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current)
      try { rec.stop() } catch {}
      try { window.speechSynthesis.cancel() } catch {}
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ---- Play start chime once when conversation begins ----
  useEffect(() => {
    if (!supported) return
    if (hasStarted) return
    if (messages.length === 0 && !loading) return
    setHasStarted(true)
    startChime()
  }, [supported, hasStarted, messages.length, loading])

  // ---- Play end chime once when transitioning to report ----
  useEffect(() => {
    if (!supported) return
    if (finishing && !endChimedRef.current) {
      endChimedRef.current = true
      endChime()
    }
  }, [finishing, supported])

  // ---- Speak each new assistant message via server TTS (Edge neural), then auto-listen ----
  useEffect(() => {
    if (!supported) return
    if (!lastAssistant) return
    const id = messages.length
    if (spokenIdsRef.current.has(id)) return
    spokenIdsRef.current.add(id)

    setSpeaking(true) // optimistic — show "AI speaking" while fetching MP3
    playServerTTS(lastAssistant.content, {
      onStart: () => setSpeaking(true),
      onEnd: () => {
        setSpeaking(false)
        if (!finishing && !loading) {
          setTimeout(() => startListening(), 250)
        }
      },
      onError: (e) => {
        console.warn('TTS error', e)
        setSpeaking(false)
        if (!finishing && !loading) {
          setTimeout(() => startListening(), 250)
        }
      },
    })
    return () => {
      // Don't stop the current speech on every re-render — only on unmount.
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages.length, supported])

  // Stop any in-flight audio on unmount
  useEffect(() => () => stopServerTTS(), [])

  function startListening() {
    if (speaking) return // never overlap AI
    setPermissionError('')
    transcriptRef.current = ''
    setTranscript('')
    setInterim('')
    submittedRef.current = false
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current)
    try {
      recognitionRef.current?.start()
      setListening(true)
    } catch {
      // start() throws if already started — restart safely
      try {
        recognitionRef.current?.stop()
        setTimeout(() => {
          try {
            recognitionRef.current?.start()
            setListening(true)
          } catch {}
        }, 200)
      } catch {}
    }
  }

  function stopListening() {
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current)
    try { recognitionRef.current?.stop() } catch {}
    setListening(false)
  }

  function autoSubmit() {
    if (submittedRef.current) return
    const text = transcriptRef.current.trim()
    if (!text) return
    submittedRef.current = true
    stopListening()
    onSubmit(text)
    transcriptRef.current = ''
    setTranscript('')
    setInterim('')
  }

  if (!supported) {
    return (
      <div className="fixed inset-0 z-[60] bg-slate-900 text-white flex items-center justify-center p-8">
        <div className="max-w-md text-center">
          <h3 className="text-2xl font-black text-red-400 mb-3">Voice interview not supported</h3>
          <p className="text-slate-300 text-sm leading-relaxed">
            Your browser does not support the Web Speech API. Please use the latest{' '}
            <strong className="text-white">Chrome</strong> or <strong className="text-white">Edge</strong> on desktop.
          </p>
        </div>
      </div>
    )
  }

  const showLiveText = transcript || interim
  const stateLabel = speaking
    ? 'INTERVIEWER SPEAKING'
    : listening
    ? 'LISTENING'
    : finishing
    ? 'WRAPPING UP'
    : loading
    ? 'THINKING'
    : 'READY'

  const orbState = speaking ? 'speaking' : listening ? 'listening' : (loading || finishing) ? 'thinking' : 'idle'

  return (
    <div className="fixed inset-0 z-[60] bg-slate-50 text-slate-900 flex flex-col">
      {/* Top bar: brand left, progress right */}
      <div className="absolute top-0 inset-x-0 z-10 px-8 pt-6 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-gradient-to-br from-blue-500 to-indigo-600">
            <span className="text-white font-black text-xs">JS</span>
          </div>
          <span className="text-sm font-black text-slate-900 tracking-tight">jobstream.</span>
        </div>
        <p className="text-[10px] font-black tracking-[0.4em] text-slate-500">
          QUESTION {Math.min(answeredCount + (speaking ? 1 : 0), totalQuestions)} / {totalQuestions}
        </p>
      </div>

      {/* Center: split layout — orb left, question + controls right */}
      <div className="flex-1 flex items-center justify-center px-8 md:px-16">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-10 md:gap-16 max-w-5xl w-full items-center">

          {/* LEFT: orb */}
          <div className="flex items-center justify-center md:justify-end">
            <SiriOrb state={orbState} />
          </div>

          {/* RIGHT: question + controls */}
          <div className="max-w-md text-center md:text-left">
            {streamingQuestion ? (
              <p className={`font-medium leading-[1.55] text-slate-700 text-base md:text-lg`}>
                {streamingQuestion}
                <span className="inline-block w-[2px] h-[1em] bg-indigo-400 ml-0.5 align-middle animate-pulse" />
              </p>
            ) : lastAssistant ? (
              <p className={`font-medium leading-[1.55] text-slate-700 transition-opacity duration-500
                  text-base md:text-lg
                  ${speaking ? 'opacity-100' : 'opacity-90'}`}>
                {lastAssistant.content}
              </p>
            ) : (
              <p className="text-slate-400 text-sm tracking-widest uppercase font-black">
                {loading ? 'Preparing your first question…' : 'Get ready…'}
              </p>
            )}

            {/* Recording / state pill */}
            <div className="mt-6 flex flex-col items-center md:items-start gap-3">
              {listening && (
                <div className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-white border border-slate-200 shadow-sm">
                  <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                  <span className="text-xs font-bold text-slate-700">Recording…</span>
                </div>
              )}
              {speaking && (
                <div className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-white border border-slate-200 shadow-sm">
                  <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
                  <span className="text-xs font-bold text-slate-700">{AI_NAME} is speaking…</span>
                </div>
              )}
              {(loading || finishing) && !speaking && (
                <div className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-white border border-slate-200 shadow-sm">
                  <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                  <span className="text-xs font-bold text-slate-700">
                    {finishing ? 'Generating report…' : 'Thinking…'}
                  </span>
                </div>
              )}

              {/* Action buttons */}
              {listening && transcript.trim() && (
                <button
                  onClick={autoSubmit}
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition shadow-lg shadow-indigo-500/20"
                >
                  Done answering? Continue
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                  </svg>
                </button>
              )}
              {!listening && !speaking && !loading && !finishing && (
                <button
                  onClick={startListening}
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition shadow-lg shadow-indigo-500/20"
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M12 14a3 3 0 003-3V5a3 3 0 00-6 0v6a3 3 0 003 3z" /><path d="M19 11a1 1 0 00-2 0 5 5 0 01-10 0 1 1 0 00-2 0 7 7 0 006 6.92V20H8a1 1 0 000 2h8a1 1 0 000-2h-3v-2.08A7 7 0 0019 11z" /></svg>
                  Start Speaking
                </button>
              )}
              {lastAssistant && !speaking && !listening && (
                <button
                  onClick={() => {
                    setSpeaking(true)
                    playServerTTS(lastAssistant.content, {
                      onStart: () => setSpeaking(true),
                      onEnd: () => setSpeaking(false),
                      onError: () => setSpeaking(false),
                    })
                  }}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-medium transition"
                >
                  ↻ Replay question
                </button>
              )}
            </div>

            {/* Live transcript */}
            {showLiveText && (
              <div className="mt-6 p-4 rounded-2xl bg-white border border-slate-200">
                <p className="text-[10px] font-black tracking-[0.3em] text-indigo-600 mb-2">YOU</p>
                <p className="text-slate-700 text-sm leading-relaxed">
                  {transcript}
                  {interim && <span className="text-slate-400 italic"> {interim}</span>}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {permissionError && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-20 max-w-md px-5 py-3 rounded-2xl border border-red-200 bg-red-50 text-red-700 text-sm">
          {permissionError}
        </div>
      )}
    </div>
  )
}

function SiriOrb({ state }) {
  // 'idle' | 'thinking' | 'speaking' | 'listening'
  const isSpeaking = state === 'speaking'
  const isListening = state === 'listening'
  const isThinking = state === 'thinking'
  const isActive = isSpeaking || isListening || isThinking

  // Iridescent rainbow ring (blue → purple → pink) for the outer halo
  const ringGradient = 'conic-gradient(from 0deg, #60a5fa, #a78bfa, #f472b6, #c084fc, #60a5fa)'

  return (
    <div className="relative w-44 h-44 md:w-56 md:h-56 flex items-center justify-center">
      {/* Outer waves when speaking — pure white blur rings expanding outward */}
      {isSpeaking && (
        <>
          <span className="absolute inset-0 rounded-full bg-indigo-200/60 blur-2xl animate-siri-wave" />
          <span className="absolute inset-0 rounded-full bg-pink-200/60 blur-2xl animate-siri-wave" style={{ animationDelay: '0.7s' }} />
        </>
      )}
      {isListening && (
        <span className="absolute inset-0 rounded-full bg-red-200/60 blur-2xl animate-siri-listen" />
      )}
      {isThinking && (
        <span className="absolute inset-0 rounded-full bg-amber-200/60 blur-2xl animate-siri-think" />
      )}

      {/* Iridescent ring (the gradient halo around the white core) */}
      <span
        className={`absolute inset-2 rounded-full ${isSpeaking ? 'animate-siri-spin-a' : ''}`}
        style={{ background: ringGradient, filter: 'blur(2px)' }}
      />
      <span
        className={`absolute inset-3 rounded-full ${isSpeaking ? 'animate-siri-spin-b' : ''} opacity-70`}
        style={{ background: ringGradient, filter: 'blur(8px)' }}
      />

      {/* White core (where the brand name sits) */}
      <span className="relative w-24 h-24 md:w-32 md:h-32 rounded-full bg-white shadow-xl flex items-center justify-center">
        <span className="text-2xl md:text-3xl font-black bg-gradient-to-br from-indigo-500 to-purple-600 bg-clip-text text-transparent tracking-tight">
          {AI_NAME.toLowerCase()}.
        </span>
      </span>
    </div>
  )
}
