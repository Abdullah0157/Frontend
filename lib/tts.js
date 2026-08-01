// Helpers for browser SpeechSynthesis. Workarounds for known Chrome issues:
// 1. Autoplay policy: speak() called outside a user gesture is silently dropped.
//    Calling speak() once inside the click handler establishes permission.
// 2. Voices aren't loaded synchronously: getVoices() can return [] on first call.
//    We warm up the cache on module load.
// 3. Cloud voices (Google US English etc.) frequently fail with "canceled" error
//    on Chrome — we prefer LOCAL voices (localService === true).
// 4. await inside a click handler breaks the gesture context for subsequent
//    speak() calls. speakText is intentionally synchronous.

let primed = false
let sharedAudioCtx = null
let cachedVoices = []

// Warm up voices on module load — by the time the user clicks, they're cached.
if (typeof window !== 'undefined' && window.speechSynthesis) {
  cachedVoices = window.speechSynthesis.getVoices()
  if (cachedVoices.length === 0) {
    window.speechSynthesis.addEventListener('voiceschanged', () => {
      cachedVoices = window.speechSynthesis.getVoices()
    })
  }
}

export function getAudioContext() {
  if (typeof window === 'undefined') return null
  if (!sharedAudioCtx) {
    const Ctx = window.AudioContext || window.webkitAudioContext
    if (!Ctx) return null
    sharedAudioCtx = new Ctx()
  }
  return sharedAudioCtx
}

// Call inside a user click handler to unlock TTS + Web Audio for the session.
export function primeTTS() {
  if (typeof window === 'undefined') return
  if (primed) return
  // Separate try/catches so a speechSynthesis failure can't prevent AudioContext activation.
  try {
    if (window.speechSynthesis) {
      const u = new SpeechSynthesisUtterance('.')
      u.volume = 0.01
      u.rate = 10
      window.speechSynthesis.speak(u)
    }
  } catch {}
  try {
    const ctx = getAudioContext()
    if (ctx) {
      if (ctx.state === 'suspended') ctx.resume().catch(() => {})
      // Play a 1-sample silent buffer through the AudioContext while still inside the
      // user gesture. Some browsers keep ctx.state === 'suspended' until actual audio
      // is scheduled — this definitively activates it.
      const buf = ctx.createBuffer(1, 1, ctx.sampleRate)
      const src = ctx.createBufferSource()
      src.buffer = buf
      src.connect(ctx.destination)
      src.start(0)
    }
  } catch {}
  // Also pre-unlock the HTMLAudioElement autoplay policy inside this same user
  // gesture. The streaming TTS path (MediaSource) plays through <audio>, which
  // Chrome blocks unless the page has had a gesture-driven play(). Priming it
  // here lets audio start on the FIRST streamed chunk instead of after the whole
  // MP3 downloads. Inlined (not imported from tts-client) to avoid an import cycle.
  try {
    const silent = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAAABkYXRhAAAAAA=='
    const a = new Audio(silent)
    a.volume = 0
    const p = a.play()
    if (p && p.then) p.then(() => { try { a.pause() } catch {} }).catch(() => {})
  } catch {}
  primed = true
}

export function isTTSPrimed() { return primed }

export function playTestChime() {
  const ctx = getAudioContext()
  if (!ctx) return false
  if (ctx.state === 'suspended') ctx.resume().catch(() => {})
  try {
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.value = 880
    const t = ctx.currentTime
    gain.gain.setValueAtTime(0.0001, t)
    gain.gain.exponentialRampToValueAtTime(0.25, t + 0.03)
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.4)
    osc.connect(gain).connect(ctx.destination)
    osc.start(t)
    osc.stop(t + 0.45)
    return true
  } catch { return false }
}

// Local female voices first — these are reliable across browsers.
// Cloud voices last (Google US English) — they often fail with "canceled".
const FEMALE_VOICE_NAMES = [
  // macOS local
  'Samantha', 'Allison', 'Ava', 'Susan', 'Victoria', 'Vicki', 'Karen',
  'Moira', 'Tessa', 'Catherine', 'Fiona', 'Serena', 'Kate', 'Veena',
  // Windows local
  'Microsoft Zira', 'Microsoft Aria', 'Microsoft Jenny', 'Microsoft Michelle',
  // Chrome cloud (last resort — frequently unreliable)
  'Google UK English Female', 'Google US English',
]

export function pickFemaleEnglishVoice(voices) {
  if (!voices || voices.length === 0) return null
  const enVoices = voices.filter((v) => /^en/i.test(v.lang))

  // Prefer LOCAL voices because cloud voices regularly silent-fail.
  const sorted = [...enVoices].sort((a, b) => {
    if (a.localService === b.localService) return 0
    return a.localService ? -1 : 1
  })

  for (const name of FEMALE_VOICE_NAMES) {
    const match = sorted.find((v) => v.name === name || v.name.startsWith(name))
    if (match) return match
  }
  const heuristic = sorted.find((v) =>
    /female|samantha|karen|allison|ava|moira|aria|zira|joanna|salli|kendra|kimberly|tessa|victoria/i.test(v.name)
  )
  if (heuristic) return heuristic
  // Any local English voice beats any cloud voice.
  return sorted.find((v) => v.localService) || sorted[0] || voices[0]
}

export function getVoices() {
  if (cachedVoices.length === 0 && typeof window !== 'undefined' && window.speechSynthesis) {
    cachedVoices = window.speechSynthesis.getVoices()
  }
  return cachedVoices
}

// Lightweight promise: only used for the explicit Test Voice button if voices haven't loaded.
export async function getVoicesReady(timeoutMs = 1500) {
  if (cachedVoices.length > 0) return cachedVoices
  if (typeof window === 'undefined' || !window.speechSynthesis) return []
  return new Promise((resolve) => {
    const synth = window.speechSynthesis
    const t = setTimeout(() => {
      synth.removeEventListener('voiceschanged', onChange)
      cachedVoices = synth.getVoices()
      resolve(cachedVoices)
    }, timeoutMs)
    const onChange = () => {
      clearTimeout(t)
      synth.removeEventListener('voiceschanged', onChange)
      cachedVoices = synth.getVoices()
      resolve(cachedVoices)
    }
    synth.addEventListener('voiceschanged', onChange)
  })
}

// SYNCHRONOUS speak — runs entirely inside the calling event handler so the
// gesture-context for autoplay is preserved. No cancel() (which puts the synth
// into a transient broken state). No await (which breaks the gesture).
export function speakText(text, { onStart, onEnd, onError, rate = 1, pitch = 1 } = {}) {
  if (typeof window === 'undefined' || !window.speechSynthesis) {
    onError?.(new Error('SpeechSynthesis not available'))
    return null
  }
  const synth = window.speechSynthesis
  const voices = getVoices()
  console.log(`[TTS] ${voices.length} voices loaded`)
  const preferred = pickFemaleEnglishVoice(voices)
  if (preferred) console.log(`[TTS] using voice: ${preferred.name} (${preferred.lang}, local=${preferred.localService})`)

  const utt = new SpeechSynthesisUtterance(text)
  utt.rate = rate
  utt.pitch = pitch
  utt.volume = 1
  if (preferred) utt.voice = preferred

  let started = false
  let finished = false
  utt.onstart = () => { console.log('[TTS] onstart'); started = true; onStart?.() }
  utt.onend = () => { console.log('[TTS] onend'); finished = true; onEnd?.() }
  utt.onerror = (e) => {
    console.warn('[TTS] onerror', e.error || e)
    finished = true
    // "canceled" / "interrupted" are normal when a new utterance overrides — don't surface as failure.
    if (e.error === 'canceled' || e.error === 'interrupted') return
    onError?.(e)
  }

  // Chrome paused-state workaround: resume() before speaking.
  try { if (synth.paused) synth.resume() } catch {}

  synth.speak(utt)
  console.log(`[TTS] speak() called — text length ${text.length}, queued=${synth.pending}, speaking=${synth.speaking}`)

  // Silent-drop fallback — but ONLY if no other utterance is in the queue/speaking.
  // If the synth is busy, our utterance is just queued and will fire onstart later.
  setTimeout(() => {
    if (started || finished) return
    if (synth.pending || synth.speaking) return // queued — give it more time
    console.warn('[TTS] silent drop detected — no onstart and synth idle')
    finished = true
    onError?.(new Error('TTS_SILENT_DROP'))
  }, 1500)

  return utt
}
