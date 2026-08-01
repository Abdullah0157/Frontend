'use client'

import { useEffect, useRef, useState } from 'react'
import { getAudioContext } from '@/lib/tts'
import { playServerTTS, stopServerTTS } from '@/lib/tts-client'
import { AI_NAME } from '@/lib/ai-config'

// Adaptive endpointing. Instead of one blind fixed wait, we lean on the two
// signals the browser already gives us:
//   1. Web Speech `isFinal` — the recognizer itself decided a phrase ended.
//      That's a real endpoint, so we can respond fast (FINAL_SILENCE_MS).
//   2. Interim-only results — still mid-word, so stay patient (INTERIM_SILENCE_MS).
// The audio-energy guard in autoSubmit() is the safety net: even after a short
// timer fires, if the mic is still hot we defer, so we never cut off someone
// who's actually still making sound. Net effect: snappy (~1.5s) turn-taking
// without clipping words.
const FINAL_SILENCE_MS   = 1500  // recognizer closed a phrase → they're likely done
const INTERIM_SILENCE_MS = 2600  // still forming words → give them room
const SHORT_ANSWER_GRACE = 900   // extra room for very short utterances (< 4 words)
// How long the mic must be quiet (no audio energy) before a fired timer submits.
const AUDIO_GUARD_MS = 1200
// How long with zero speech activity before Iris checks in.
const NO_SPEECH_MS = 15000

// Optimistic acknowledgment was removed after Sprint 3 hotfix — it created a
// race between the ack's TTS fetch and the next question's TTS fetch. When
// both were in-flight on the same AudioContext, they'd overlap or the ack's
// onEnd callback would override the real TTS's speaking state mid-flight,
// leaving audible silence. Re-enable only when playServerTTS gains proper
// cancellation tokens.

const TEST_PHRASES = [
  'can you hear me', 'do you hear me', 'are you there', 'can you hear',
  'hello iris', 'hi iris', 'iris are you there', 'iris can you hear',
  'testing', 'is this working', 'check check', 'mic check',
]
function isTestPhrase(text) {
  if (text.trim().split(/\s+/).length > 8) return false
  const lower = text.toLowerCase().trim()
  return TEST_PHRASES.some((p) => lower === p || lower.startsWith(p + ' ') || lower.startsWith(p + ','))
}

const REPEAT_TRIGGERS = [
  'can you repeat', 'could you repeat', 'please repeat', 'repeat the question',
  "can't hear you", "i can't hear you", "i cannot hear", "cannot hear you",
  "i didn't hear", "i couldn't hear", "didn't catch that", "couldn't catch that",
  'say that again', 'say it again please', 'i need you to repeat',
]
const REPEAT_INTROS = [
  "Of course, here's the question again.",
  "Sure, let me repeat that.",
  "No problem, here it is again.",
  "Absolutely, here it is.",
]
function isRepeatRequest(text) {
  const words = text.trim().split(/\s+/)
  if (words.length > 15) return false  // long answer, not a repeat request
  const lower = text.toLowerCase().trim()
  return REPEAT_TRIGGERS.some((p) => lower.includes(p))
}
function pickRepeatIntro() {
  return REPEAT_INTROS[Math.floor(Math.random() * REPEAT_INTROS.length)]
}

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
  } catch (e) { console.warn('chime failed:', e) }
}
function startChime() { playChime([[523.25, 0.18, 0], [659.25, 0.18, 0.15], [783.99, 0.32, 0.3]]) }
function endChime()   { playChime([[783.99, 0.18, 0], [659.25, 0.18, 0.18], [523.25, 0.4, 0.36]]) }

export default function VoiceChat({ messages, loading, finishing, streamingQuestion = '', onSubmit, totalQuestions, headerLabel = null, onEnd = null, aiName = AI_NAME, voice = undefined, sttContext = '' }) {
  const [supported, setSupported]               = useState(true)
  const [speaking, setSpeaking]                 = useState(false)
  const [listening, setListening]               = useState(false)
  const [isTranscribing, setIsTranscribing]     = useState(false)
  const [transcript, setTranscript]             = useState('')
  const [interim, setInterim]                   = useState('')
  const [volumeLevel, setVolumeLevel]           = useState(0)
  const [permissionError, setPermissionError]   = useState('')
  const [hasStarted, setHasStarted]             = useState(false)
  const [captionWordIdx, setCaptionWordIdx]     = useState(0)
  const [silencePrompted, setSilencePrompted]   = useState(false)
  const [ttsStartedForLength, setTtsStartedForLength] = useState(-1)
  const [useTextInput, setUseTextInput]         = useState(false)
  const [textDraft, setTextDraft]               = useState('')

  // TTS refs
  const spokenIdsRef      = useRef(new Set())
  const isTTSPlayingRef   = useRef(false)
  const captionTimersRef  = useRef([])
  const lastAssistantRef  = useRef(null)
  const endChimedRef      = useRef(false)

  // STT refs
  const recognitionRef    = useRef(null)   // Web Speech API
  const mediaRecorderRef  = useRef(null)
  const audioChunksRef    = useRef([])
  const micStreamRef      = useRef(null)
  const mimeTypeRef       = useRef('')
  const analyserRef       = useRef(null)
  const vadCtxRef         = useRef(null)
  const vadIntervalRef    = useRef(null)

  // Control refs
  const transcriptRef     = useRef('')
  const silenceTimerRef   = useRef(null)
  const noSpeechTimerRef  = useRef(null)
  const submittedRef      = useRef(false)
  const listeningRef      = useRef(false)
  const silencePromptedRef = useRef(false)
  const silencePromptCountRef = useRef(0)  // tracks per-question "are you there?" prompts
  const replayingRef      = useRef(false)  // guards repeat-request from firing twice (double audio)
  const acquiringRef      = useRef(false)
  const lastAudioRef      = useRef(0)

  const answeredCount = messages.filter((m) => m.role === 'user').length
  const lastAssistant = [...messages].reverse().find((m) => m.role === 'assistant')
  useEffect(() => { lastAssistantRef.current = lastAssistant }, [lastAssistant])

  // ── Browser support ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (typeof window === 'undefined') return
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SR && !navigator.mediaDevices?.getUserMedia) {
      setSupported(false)
    }
  }, [])

  // ── Web Speech API — live display + silence detection ─────────────────────────
  useEffect(() => {
    if (typeof window === 'undefined') return
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SR) return
    const rec = new SR()
    rec.continuous     = true
    rec.interimResults = true
    rec.lang           = 'en-US'

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

      // Any speech → cancel the no-speech check-in
      if (noSpeechTimerRef.current) { clearTimeout(noSpeechTimerRef.current); noSpeechTimerRef.current = null }

      // Detect repeat requests at any point during listening
      const heard = (transcriptRef.current + ' ' + interimText).toLowerCase()
      if (isRepeatRequest(heard)) {
        if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current)
        if (noSpeechTimerRef.current) clearTimeout(noSpeechTimerRef.current)
        replayWithIntro(pickRepeatIntro())
        return
      }
      if (silencePromptedRef.current) {
        silencePromptedRef.current = false
        setSilencePrompted(false)
      }

      // Reset silence timer on every word, then re-arm with an adaptive wait.
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current)
      if (transcriptRef.current.length + interimText.length > 0) {
        // A final chunk means the recognizer detected a real endpoint → respond
        // fast. Interim-only means they're still mid-word → be patient.
        let wait = finalAddition ? FINAL_SILENCE_MS : INTERIM_SILENCE_MS
        // Very short utterances get extra grace — they're probably just starting.
        const wordCount = transcriptRef.current.split(/\s+/).filter(Boolean).length
        if (wordCount < 4) wait += SHORT_ANSWER_GRACE
        silenceTimerRef.current = setTimeout(() => autoSubmit(), wait)
      }
    }

    rec.onerror = (e) => {
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
        setPermissionError('Microphone access denied. Allow mic in your browser settings and reload.')
        listeningRef.current = false; setListening(false); setUseTextInput(true)
      } else if (e.error === 'audio-capture') {
        setPermissionError('No microphone detected. Check your device settings.')
        listeningRef.current = false; setListening(false); setUseTextInput(true)
      }
      // no-speech and aborted are normal — ignore
    }

    rec.onend = () => {
      setInterim('')
      if (!listeningRef.current) { setListening(false); return }
      // Chrome fires onend during pauses with continuous=true — restart silently
      try { rec.start() } catch { listeningRef.current = false; setListening(false) }
    }

    recognitionRef.current = rec
    return () => { try { rec.stop() } catch {} }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Chimes ────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!supported || hasStarted) return
    if (messages.length === 0 && !loading) return
    setHasStarted(true); startChime()
  }, [supported, hasStarted, messages.length, loading])

  useEffect(() => {
    if (!supported) return
    if (finishing && !endChimedRef.current) { endChimedRef.current = true; endChime() }
  }, [finishing, supported])

  // ── Caption animation ─────────────────────────────────────────────────────────
  function clearCaptionTimers() {
    captionTimersRef.current.forEach((t) => clearTimeout(t))
    captionTimersRef.current = []
  }
  function startCaptionAnimation(text) {
    clearCaptionTimers()
    const words = text.split(/\s+/)
    if (!words.length) return
    const totalMs = Math.max(800, (text.replace(/\s+/g, '').length / 12) * 1000)
    const weights = words.map((w) => {
      const l = w.replace(/[^a-zA-Z0-9]/g, '').length
      return Math.max(0.4, l * 0.75) + (/[.!?]$/.test(w) ? 3.5 : 0) + (/[,;:]$/.test(w) ? 1.8 : 0)
    })
    const total = weights.reduce((a, b) => a + b, 0)
    setCaptionWordIdx(0)
    let acc = 0
    words.forEach((_, i) => {
      acc += (weights[i] / total) * totalMs
      captionTimersRef.current.push(setTimeout(() => setCaptionWordIdx(i + 1), acc))
    })
  }

  // ── Auto-start mic after Iris finishes ────────────────────────────────────────
  useEffect(() => {
    if (!supported) return
    if (speaking || listening || isTranscribing || loading || finishing || messages.length === 0) return
    if (isTTSPlayingRef.current) return
    const t = setTimeout(() => startListening(), 500)
    return () => clearTimeout(t)
  }, [speaking, listening, isTranscribing, loading, finishing, messages.length, supported]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Speak each new assistant message ──────────────────────────────────────────
  useEffect(() => {
    if (!supported || !lastAssistant) return
    const lastMsg = messages[messages.length - 1]
    if (!lastMsg || lastMsg.role !== 'assistant') return
    const id = messages.length
    if (spokenIdsRef.current.has(id)) return
    spokenIdsRef.current.add(id)
    const text = lastAssistant.content
    stopServerTTS()  // never overlap with any audio still playing (fixes double-voice)
    setSpeaking(true)
    isTTSPlayingRef.current = true  // set immediately so auto-start mic effect won't race
    playServerTTS(text, { voice,
      onStart: () => {
        setSpeaking(true); isTTSPlayingRef.current = true; setTtsStartedForLength(id)
        // Always show the FULL question text immediately when Iris starts speaking.
        // No word-by-word animation — the animation drifted out of sync with the
        // actual audio (especially on the browser fallback voice) and made the
        // question hard to read.
        setCaptionWordIdx(Infinity)
      },
      onEnd:   () => { setSpeaking(false); isTTSPlayingRef.current = false; clearCaptionTimers(); setCaptionWordIdx(Infinity); if (!finishing && !loading) setTimeout(() => startListening(), 800) },
      onError: () => { setSpeaking(false); isTTSPlayingRef.current = false; clearCaptionTimers(); setCaptionWordIdx(Infinity); if (!finishing && !loading) setTimeout(() => startListening(), 800) },
    }).catch(() => { setSpeaking(false); isTTSPlayingRef.current = false; if (!finishing && !loading) setTimeout(() => startListening(), 800) })
    return () => {}
  }, [messages.length, supported]) // eslint-disable-line react-hooks/exhaustive-deps

  // Stop TTS when next question loads. Also resets the silence-prompt counter
  // so each question gets a fresh chance at the prompt-then-advance policy.
  useEffect(() => {
    if (loading) {
      stopServerTTS(); isTTSPlayingRef.current = false; setSpeaking(false)
      clearCaptionTimers(); setTtsStartedForLength(-1)
      silencePromptedRef.current = false; setSilencePrompted(false)
      silencePromptCountRef.current = 0
      replayingRef.current = false
    }
  }, [loading]) // eslint-disable-line react-hooks/exhaustive-deps

  // Cleanup on unmount
  useEffect(() => () => { stopServerTTS(); clearCaptionTimers(); _stopMic() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Mic helpers ───────────────────────────────────────────────────────────────
  function _stopMic() {
    if (vadIntervalRef.current) { clearInterval(vadIntervalRef.current); vadIntervalRef.current = null }
    if (vadCtxRef.current) { try { vadCtxRef.current.close() } catch {}; vadCtxRef.current = null }
    analyserRef.current = null
    const mr = mediaRecorderRef.current
    if (mr && mr.state !== 'inactive') try { mr.stop() } catch {}
    mediaRecorderRef.current = null
    audioChunksRef.current = []
    if (micStreamRef.current) { micStreamRef.current.getTracks().forEach((t) => t.stop()); micStreamRef.current = null }
    acquiringRef.current = false
  }

  async function startListening() {
    if (speaking || isTTSPlayingRef.current || listeningRef.current || acquiringRef.current) return
    acquiringRef.current = true
    setPermissionError('')
    transcriptRef.current = ''
    setTranscript('')
    setInterim('')
    submittedRef.current = false

    // Start Web Speech API for live display
    try { recognitionRef.current?.start() } catch {}

    // Separate getUserMedia for MediaRecorder (echo cancellation prevents TTS bleed)
    let stream
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          channelCount: 1,        // mono — cleaner input for Whisper
        },
        video: false,
      })
    } catch (err) {
      acquiringRef.current = false
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setPermissionError('Microphone access denied. Allow mic in your browser settings and reload.')
      } else {
        setPermissionError('No microphone detected. Check your device settings.')
      }
      setUseTextInput(true)
      return
    }
    acquiringRef.current = false
    micStreamRef.current = stream

    // Volume bars via AnalyserNode (display only)
    try {
      const vc = new (window.AudioContext || window.webkitAudioContext)()
      if (vc.state === 'suspended') vc.resume().catch(() => {})
      vadCtxRef.current = vc
      const src = vc.createMediaStreamSource(stream)
      const an  = vc.createAnalyser(); an.fftSize = 512
      src.connect(an); analyserRef.current = an
      const buf = new Uint8Array(an.fftSize)
      vadIntervalRef.current = setInterval(() => {
        if (!analyserRef.current) return
        analyserRef.current.getByteTimeDomainData(buf)
        const rms = Math.sqrt(buf.reduce((s, v) => s + (v - 128) ** 2, 0) / buf.length)
        const vol = Math.min(100, (rms / 50) * 100)
        setVolumeLevel(vol)
        if (vol > 10) lastAudioRef.current = Date.now()
      }, 80)
    } catch {}

    // MediaRecorder for Whisper audio
    audioChunksRef.current = []
    const mimeType = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/mp4']
      .find((t) => MediaRecorder.isTypeSupported(t)) || ''
    mimeTypeRef.current = mimeType
    const mr = new MediaRecorder(stream, mimeType ? { mimeType } : {})
    mr.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data) }
    mr.start(200)
    mediaRecorderRef.current = mr

    // Silence policy per question (v3):
    // - After NO_SPEECH_MS with no speech → auto-advance to next question by
    //   submitting a placeholder. NO "Are you still there?" prompt — that
    //   interrupted candidates who were just thinking and felt intrusive.
    // - Manual replay is still available: if the CANDIDATE says "repeat" or
    //   "can you repeat", isRepeatRequest() catches it and replays the last Q.
    if (noSpeechTimerRef.current) clearTimeout(noSpeechTimerRef.current)
    noSpeechTimerRef.current = setTimeout(() => {
      if (transcriptRef.current.trim()) return  // they spoke, timer canceled elsewhere
      console.log('[VoiceChat] no answer after 15s — auto-advancing to next question')
      submittedRef.current = true
      stopListening()
      onSubmit('(no response)')
    }, NO_SPEECH_MS)

    listeningRef.current = true
    setListening(true)
  }

  function stopListening() {
    listeningRef.current = false
    if (silenceTimerRef.current) { clearTimeout(silenceTimerRef.current); silenceTimerRef.current = null }
    if (noSpeechTimerRef.current) { clearTimeout(noSpeechTimerRef.current); noSpeechTimerRef.current = null }
    try { recognitionRef.current?.stop() } catch {}
    _stopMic()
    setListening(false)
    setVolumeLevel(0)
  }

  // Sprint 3 hotfix v2: Whisper is now the source of truth for what Iris sees.
  // Web Speech's transcripts are fast but frequently mangle non-American accents,
  // multi-syllable words, and technical vocabulary — Iris then responds to garbage
  // and looks incoherent. Whisper is 1-2s slower but dramatically more accurate.
  // Web Speech is still used for LIVE captions and silence detection (fast, and
  // accuracy doesn't matter for those).
  async function autoSubmit() {
    if (submittedRef.current) return
    // Audio-energy guard: if the mic was hot in the last AUDIO_GUARD_MS, the
    // person is probably still mid-thought — defer instead of cutting them off.
    // This is the safety net that makes the short timers above safe.
    const msSinceAudio = Date.now() - lastAudioRef.current
    if (!silencePromptedRef.current && lastAudioRef.current > 0 && msSinceAudio < AUDIO_GUARD_MS) {
      silenceTimerRef.current = setTimeout(() => autoSubmit(), AUDIO_GUARD_MS - msSinceAudio + 150)
      return
    }
    const wsText = transcriptRef.current.trim()

    if (silencePromptedRef.current || isRepeatRequest(wsText)) {
      silencePromptedRef.current = false; setSilencePrompted(false)
      if (!wsText || isRepeatRequest(wsText)) { replayWithIntro(pickRepeatIntro()); return }
    }
    if (!wsText) {
      // No transcript at all — just move on. No "are you still there" prompt.
      console.log('[VoiceChat] empty transcript — auto-advancing')
      submittedRef.current = true
      stopListening()
      onSubmit('(no response)')
      return
    }

    // Stop recognition + recording so we can send the audio to Whisper.
    try { recognitionRef.current?.stop() } catch {}
    listeningRef.current = false

    // Wait for MediaRecorder to fully stop so we have all chunks.
    const mr = mediaRecorderRef.current
    if (mr && mr.state !== 'inactive') {
      await new Promise((resolve) => { mr.onstop = resolve; try { mr.stop() } catch { resolve() } })
    }
    const chunks = audioChunksRef.current.slice()
    _stopMic()
    setListening(false); setVolumeLevel(0); setInterim('')

    if (chunks.length > 0) {
      setIsTranscribing(true)
      try {
        const mimeType = mimeTypeRef.current || 'audio/webm'
        const ext = mimeType.includes('ogg') ? 'ogg' : mimeType.includes('mp4') ? 'mp4' : 'webm'
        const blob = new Blob(chunks, { type: mimeType })
        const fd = new FormData()
        fd.append('audio', blob, `audio.${ext}`)
        if (sttContext) fd.append('context', sttContext) // domain vocabulary → better term accuracy
        const res = await fetch('/api/stt', { method: 'POST', body: fd })
        if (res.ok) {
          const { text } = await res.json()
          const whisperText = text?.trim()
          if (whisperText && whisperText.length >= 3) {
            setIsTranscribing(false)
            if (isTestPhrase(whisperText)) { respondTestPhrase(); return }
            setTranscript(whisperText)
            submittedRef.current = true
            onSubmit(whisperText)
            setTranscript(''); transcriptRef.current = ''
            return
          }
        }
      } catch (e) { console.warn('Whisper failed, falling back to Web Speech:', e) }
      setIsTranscribing(false)
    }

    // Last-resort fallback: use whatever short Web Speech text we have, or
    // prompt if empty.
    if (!wsText) {
      // No transcript at all — just move on. No "are you still there" prompt.
      console.log('[VoiceChat] empty transcript — auto-advancing')
      submittedRef.current = true
      stopListening()
      onSubmit('(no response)')
      return
    }
    if (isTestPhrase(wsText)) { respondTestPhrase(); return }
    submittedRef.current = true
    onSubmit(wsText)
    setTranscript(''); transcriptRef.current = ''; setInterim('')
  }

  function promptAfterSilence() {
    silencePromptedRef.current = true; setSilencePrompted(true)
    silencePromptCountRef.current += 1
    stopListening()
    const text = "Are you still there? Take your time — say repeat to hear the question again, or just start speaking when you're ready."
    stopServerTTS()  // no overlap
    setSpeaking(true); isTTSPlayingRef.current = true
    playServerTTS(text, { voice,
      onStart: () => { setSpeaking(true); isTTSPlayingRef.current = true },
      onEnd:   () => { setSpeaking(false); isTTSPlayingRef.current = false; setTimeout(() => startListening(), 800) },
      onError: () => { setSpeaking(false); isTTSPlayingRef.current = false; silencePromptedRef.current = false; setSilencePrompted(false); setTimeout(() => startListening(), 800) },
    })
  }

  function replayWithIntro(intro) {
    const la = lastAssistantRef.current; if (!la) return
    if (replayingRef.current) return  // guard against a double repeat-trigger → double audio
    replayingRef.current = true
    silencePromptedRef.current = false; setSilencePrompted(false)
    stopListening()
    stopServerTTS()  // kill any audio still playing before the repeat
    submittedRef.current = false; transcriptRef.current = ''; setTranscript(''); setInterim('')
    setSpeaking(true); isTTSPlayingRef.current = true
    playServerTTS(intro, { voice,
      onStart: () => { setSpeaking(true); isTTSPlayingRef.current = true },
      onEnd:   () => replayQuestion(),
      onError: () => replayQuestion(),
    }).catch(() => replayQuestion())
  }

  function replayQuestion() {
    const la = lastAssistantRef.current; if (!la) return
    silencePromptedRef.current = false; setSilencePrompted(false)
    stopListening()
    stopServerTTS()  // ensure the intro finished cleanly and nothing overlaps
    submittedRef.current = false; transcriptRef.current = ''; setTranscript(''); setInterim('')
    const text = la.content; const replayLen = messages.length
    setSpeaking(true); isTTSPlayingRef.current = true
    playServerTTS(text, { voice,
      onStart: () => { setSpeaking(true); isTTSPlayingRef.current = true; setTtsStartedForLength(replayLen); setCaptionWordIdx(0); startCaptionAnimation(text) },
      onEnd:   () => { setSpeaking(false); isTTSPlayingRef.current = false; replayingRef.current = false; clearCaptionTimers(); setCaptionWordIdx(Infinity); setTimeout(() => startListening(), 800) },
      onError: () => { setSpeaking(false); isTTSPlayingRef.current = false; replayingRef.current = false; clearCaptionTimers(); setCaptionWordIdx(Infinity); setTimeout(() => startListening(), 800) },
    })
  }

  function respondTestPhrase() {
    stopListening()
    stopServerTTS()  // no overlap with in-flight audio
    const reply = "Yes, I can hear you clearly! Go ahead whenever you're ready."
    setSpeaking(true); isTTSPlayingRef.current = true
    playServerTTS(reply, { voice,
      onStart: () => { setSpeaking(true); isTTSPlayingRef.current = true },
      onEnd:   () => { setSpeaking(false); isTTSPlayingRef.current = false; setTimeout(() => startListening(), 800) },
      onError: () => { setSpeaking(false); isTTSPlayingRef.current = false; setTimeout(() => startListening(), 800) },
    })
  }

  // ── Render ────────────────────────────────────────────────────────────────────
  if (!supported) {
    return (
      <div className="fixed inset-0 z-[60] bg-slate-50 text-slate-900 flex items-center justify-center p-8">
        <div className="max-w-md text-center">
          <h3 className="text-2xl font-black text-red-600 mb-3">Voice not supported</h3>
          <p className="text-slate-600 text-sm leading-relaxed">
            Please use the latest <strong className="text-slate-900">Chrome</strong> or <strong className="text-slate-900">Edge</strong> on desktop.
          </p>
        </div>
      </div>
    )
  }

  const orbState    = speaking ? 'speaking' : isTranscribing ? 'thinking' : listening ? 'listening' : (loading || finishing) ? 'thinking' : 'idle'
  const ttsLoading  = speaking && ttsStartedForLength !== messages.length
  const ttsActive   = ttsStartedForLength === messages.length
  const assistantCount = messages.filter((m) => m.role === 'assistant').length
  const displayQ    = String(Math.min(assistantCount || 1, totalQuestions)).padStart(2, '0')
  const displayTotal = String(totalQuestions).padStart(2, '0')

  return (
    <div className="fixed inset-0 z-[60] bg-slate-50 text-slate-900 flex flex-col">
      {/* Top bar */}
      <div className="absolute top-0 inset-x-0 z-10 px-8 pt-6 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <img src="/jobstream-icon.png" alt="Jobstream" className="w-8 h-8 object-contain" />
          <span className="text-sm font-black text-slate-900 tracking-tight">jobstream.</span>
        </div>
        <div className="flex items-center gap-4">
          <p className="text-[10px] font-black tracking-[0.4em] text-slate-500">
            {headerLabel != null ? headerLabel : `QUESTION ${displayQ} / ${displayTotal}`}
          </p>
          {onEnd && (
            <button
              onClick={onEnd}
              className="text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-full bg-slate-200 hover:bg-slate-300 text-slate-700 transition"
            >
              End &amp; get report
            </button>
          )}
        </div>
      </div>

      {/* Center */}
      <div className="flex-1 flex items-center justify-center px-8 md:px-16">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-10 md:gap-16 max-w-5xl w-full items-center">

          {/* Orb */}
          <div className="flex items-center justify-center md:justify-end">
            <SiriOrb state={orbState} volumeLevel={volumeLevel} aiName={aiName} />
          </div>

          {/* Right panel */}
          <div className="max-w-md text-center md:text-left">

            {/* Question text */}
            <div className="min-h-[4rem]">
              {(streamingQuestion || ttsLoading) ? (
                <p className="text-slate-400 text-sm tracking-widest uppercase font-black">{aiName} is preparing...</p>
              ) : lastAssistant ? (
                <p className="font-medium leading-[1.65] text-slate-800 text-base md:text-lg">
                  {(() => {
                    const words = lastAssistant.content.split(/\s+/)
                    const visible = (ttsActive && captionWordIdx !== Infinity)
                      ? words.slice(0, captionWordIdx).join(' ') || ' '
                      : lastAssistant.content
                    const cursor = ttsActive && captionWordIdx !== Infinity && captionWordIdx < words.length
                    return <>{visible}{cursor && <span className="inline-block w-[2px] h-[1em] bg-indigo-500 ml-1 align-middle animate-pulse" />}</>
                  })()}
                </p>
              ) : (
                <p className="text-slate-400 text-sm tracking-widest uppercase font-black">
                  {loading ? 'Preparing your first question...' : 'Get ready...'}
                </p>
              )}
            </div>

            {/* Status pills */}
            <div className="mt-6 flex flex-col items-center md:items-start gap-3">

              {speaking && (
                <div className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-white border border-slate-200 shadow-sm">
                  <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
                  <span className="text-xs font-bold text-slate-700">{aiName} is speaking...</span>
                </div>
              )}

              {listening && !isTranscribing && (
                <div className="inline-flex items-center gap-2.5 px-5 py-2.5 rounded-full bg-white border border-slate-200 shadow-sm">
                  <span className={`w-2 h-2 rounded-full animate-pulse ${silencePrompted ? 'bg-amber-500' : 'bg-red-500'}`} />
                  <span className="text-xs font-bold text-slate-700">
                    {silencePrompted ? "Say 'repeat' to replay..." : 'Listening — speak your answer...'}
                  </span>
                  {!silencePrompted && (
                    <span className="flex items-end gap-[2px] h-4">
                      {[0.4, 0.7, 1, 0.7, 0.4].map((s, i) => (
                        <span key={i} className="w-[3px] rounded-full bg-red-400 transition-all duration-75"
                          style={{ height: `${Math.max(3, (volumeLevel / 100) * 14 * s)}px` }} />
                      ))}
                    </span>
                  )}
                </div>
              )}

              {isTranscribing && (
                <div className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-white border border-slate-200 shadow-sm">
                  <span className="w-2 h-2 rounded-full bg-violet-500 animate-pulse" />
                  <span className="text-xs font-bold text-slate-700">Understanding your answer...</span>
                </div>
              )}

              {silencePrompted && (
                <button onClick={replayQuestion}
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-full bg-white border border-slate-300 hover:border-indigo-400 text-slate-700 hover:text-indigo-600 text-xs font-bold transition shadow-sm">
                  ↻ Repeat question
                </button>
              )}

              {(loading || finishing) && !speaking && !isTranscribing && (
                <div className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-white border border-slate-200 shadow-sm">
                  <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                  <span className="text-xs font-bold text-slate-700">{finishing ? 'Generating report...' : 'Thinking...'}</span>
                </div>
              )}

              {lastAssistant && spokenIdsRef.current.has(messages.length) && !ttsActive && !speaking && !loading && !finishing && (
                <button onClick={replayQuestion}
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition shadow-lg shadow-indigo-500/20 animate-pulse">
                  ▶ Tap to hear {aiName}
                </button>
              )}

              {lastAssistant && ttsActive && captionWordIdx === Infinity && !speaking && !listening && !loading && !finishing && (
                <button onClick={replayQuestion}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-medium transition">
                  ↻ Replay question
                </button>
              )}
            </div>

            {/* Live transcript */}
            {(transcript || interim) && !useTextInput && (
              <div className="mt-6 p-4 rounded-2xl bg-white border border-slate-200">
                <p className="text-[10px] font-black tracking-[0.3em] text-indigo-600 mb-2">YOU</p>
                <p className="text-slate-700 text-sm leading-relaxed">
                  {transcript}
                  {interim && <span className="text-slate-400"> {interim}</span>}
                </p>
              </div>
            )}

            {/* Text input fallback */}
            {useTextInput && !loading && !finishing && lastAssistant && (
              <div className="mt-6">
                <textarea
                  className="w-full px-4 py-3 rounded-2xl border border-slate-300 bg-white text-slate-800 text-sm resize-none focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                  rows={3} placeholder="Type your answer here..."
                  value={textDraft} onChange={(e) => setTextDraft(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey && textDraft.trim()) { e.preventDefault(); const a = textDraft.trim(); setTextDraft(''); onSubmit(a) } }}
                />
                <button disabled={!textDraft.trim()}
                  onClick={() => { const a = textDraft.trim(); if (a) { setTextDraft(''); onSubmit(a) } }}
                  className="mt-2 inline-flex items-center gap-2 px-6 py-3 rounded-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white text-xs font-bold transition shadow-lg shadow-indigo-500/20">
                  Submit answer →
                </button>
              </div>
            )}

            {!useTextInput && !loading && !finishing && lastAssistant && !permissionError && (
              <button onClick={() => { stopListening(); setUseTextInput(true) }}
                className="mt-4 text-[10px] text-slate-400 hover:text-slate-600 underline underline-offset-2">
                Prefer to type?
              </button>
            )}
            {useTextInput && !permissionError && (
              <button onClick={() => { setUseTextInput(false); setTextDraft('') }}
                className="mt-2 text-[10px] text-slate-400 hover:text-slate-600 underline underline-offset-2">
                Switch back to voice
              </button>
            )}
          </div>
        </div>
      </div>

      {permissionError && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-20 max-w-md px-5 py-3 rounded-2xl border border-red-200 bg-red-50 text-red-700 text-sm text-center">
          {permissionError}
        </div>
      )}
    </div>
  )
}

function SiriOrb({ state, volumeLevel = 0, aiName = AI_NAME }) {
  const isSpeaking  = state === 'speaking'
  const isListening = state === 'listening'
  const isThinking  = state === 'thinking'
  const ring  = 'conic-gradient(from 0deg, #60a5fa, #a78bfa, #f472b6, #c084fc, #60a5fa)'
  const scale = isListening ? 1 + (volumeLevel / 100) * 0.1 : 1

  return (
    <div className="relative w-44 h-44 md:w-56 md:h-56 flex items-center justify-center">
      {isSpeaking  && <><span className="absolute inset-0 rounded-full bg-indigo-200/60 blur-2xl animate-siri-wave" /><span className="absolute inset-0 rounded-full bg-pink-200/60 blur-2xl animate-siri-wave" style={{ animationDelay: '0.7s' }} /></>}
      {isListening && <span className="absolute inset-0 rounded-full bg-red-200/60 blur-2xl transition-transform duration-75" style={{ transform: `scale(${scale})` }} />}
      {isThinking  && <span className="absolute inset-0 rounded-full bg-amber-200/60 blur-2xl animate-siri-think" />}
      <span className={`absolute inset-2 rounded-full ${isSpeaking ? 'animate-siri-spin-a' : ''}`} style={{ background: ring, filter: 'blur(2px)' }} />
      <span className={`absolute inset-3 rounded-full ${isSpeaking ? 'animate-siri-spin-b' : ''} opacity-70`} style={{ background: ring, filter: 'blur(8px)' }} />
      <span className="relative w-24 h-24 md:w-32 md:h-32 rounded-full bg-white shadow-xl flex items-center justify-center">
        <span className="text-2xl md:text-3xl font-black bg-gradient-to-br from-indigo-500 to-purple-600 bg-clip-text text-transparent tracking-tight">
          {aiName.toLowerCase()}.
        </span>
      </span>
    </div>
  )
}
