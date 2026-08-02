// Client-side TTS player. Uses MediaSource API for streaming playback (audio
// starts as soon as the first chunk arrives instead of after the full MP3
// downloads). Falls back to the old blob approach in browsers without MSE
// support for audio/mpeg (e.g. older Safari).
//
// Sprint 3 hotfix: if the server TTS route (/api/tts → msedge-tts) is
// unavailable (network block, outage, or DNS failure), we fall back to the
// browser's built-in SpeechSynthesis so the candidate always hears Iris.
// Voice quality is lower but zero-dependency and works offline.

import { getAudioContext } from './tts'

let currentAudio = null
let currentMediaSource = null
let currentBrowserUtterance = null
let audioUnlocked = false

// Voice cache — Chrome's getVoices() returns [] on first call before the
// voice list is populated. We warm it on module load and re-fetch when
// the browser fires voiceschanged. Prevents "no voice" on first TTS call.
let cachedVoices = []
if (typeof window !== 'undefined' && window.speechSynthesis) {
  cachedVoices = window.speechSynthesis.getVoices()
  if (cachedVoices.length === 0) {
    window.speechSynthesis.addEventListener('voiceschanged', () => {
      cachedVoices = window.speechSynthesis.getVoices()
    })
  }
}

// Iris is female — prefer known-female voices, in order. Mac ships several
// female voices (Samantha is the default); Windows ships Zira/Aria. Male
// voices like "Alex" or "Fred" appear alphabetically first in getVoices()
// so we cannot just take voices[0] — we'd get the wrong gender.
const FEMALE_VOICE_NAMES = [
  // macOS local
  'Samantha', 'Allison', 'Ava', 'Susan', 'Victoria', 'Vicki', 'Karen',
  'Moira', 'Tessa', 'Catherine', 'Fiona', 'Serena', 'Kate', 'Veena',
  // Windows local
  'Microsoft Zira', 'Microsoft Aria', 'Microsoft Jenny', 'Microsoft Michelle',
  // Chrome cloud
  'Google UK English Female', 'Google US English',
]

// British female browser voices — used to give Maya (en-GB) a distinct accent
// from Iris (en-US) even on the browser-TTS fallback path.
const GB_FEMALE_VOICE_NAMES = ['Kate', 'Serena', 'Stephanie', 'Martha', 'Google UK English Female']

// localePref: e.g. 'en-GB' → prefer British female voices so Maya sounds
// different from Iris. Defaults to US-leaning female voices.
function pickIrisVoice(voices, localePref) {
  if (!voices?.length) return null
  const enVoices = voices.filter((v) => /^en/i.test(v.lang))
  const sorted = [...enVoices].sort((a, b) => {
    if (a.localService === b.localService) return 0
    return a.localService ? -1 : 1
  })

  // If a locale is requested (Maya = en-GB), try a matching-locale female voice first.
  if (localePref) {
    const localeVoices = sorted.filter((v) => v.lang.toLowerCase().startsWith(localePref.toLowerCase()))
    const names = localePref.toLowerCase().startsWith('en-gb') ? GB_FEMALE_VOICE_NAMES : FEMALE_VOICE_NAMES
    for (const name of names) {
      const match = localeVoices.find((v) => v.name === name || v.name.startsWith(name))
      if (match) return match
    }
    // any female-ish voice in that locale
    const femInLocale = localeVoices.find((v) => /female|kate|serena|martha|stephanie|karen|moira|tessa/i.test(v.name))
    if (femInLocale) return femInLocale
    if (localeVoices.length) return localeVoices[0]
  }

  // Default (Iris): US-leaning female voice.
  for (const name of FEMALE_VOICE_NAMES) {
    const match = sorted.find((v) => v.name === name || v.name.startsWith(name))
    if (match) return match
  }
  const heuristic = sorted.find((v) =>
    /female|samantha|karen|allison|ava|moira|aria|zira|joanna|salli|kendra|kimberly|tessa|victoria/i.test(v.name)
  )
  if (heuristic) return heuristic
  return sorted.find((v) => v.localService) || sorted[0] || voices[0]
}

// Try browser SpeechSynthesis as a last-resort fallback. Used when /api/tts
// returns non-ok or the fetch itself fails. Best-effort — some browsers
// silent-drop utterances; onerror + a timeout catch that case.
// Async because we may need to wait briefly for voices to load on cold start.
async function speakViaBrowser(text, { onStart, onEnd, onError, voice } = {}) {
  if (typeof window === 'undefined' || !window.speechSynthesis) {
    onError?.(new Error('SpeechSynthesis not available'))
    return false
  }
  try {
    // Use cached voices from module load + voiceschanged listener; refetch as
    // a safety in case cache is still empty (very old browsers).
    let voices = cachedVoices.length ? cachedVoices : window.speechSynthesis.getVoices()
    if (!voices.length) {
      // Voices really not ready yet — retry once after a short beat.
      await new Promise((r) => setTimeout(r, 200))
      voices = window.speechSynthesis.getVoices()
      if (voices.length) cachedVoices = voices
    }
    // Derive a locale from the requested msedge voice (e.g. "en-GB-SoniaNeural"
    // → "en-GB") so Maya gets a British browser voice, distinct from Iris.
    const localePref = typeof voice === 'string' && /^([a-z]{2}-[A-Z]{2})/.exec(voice)?.[1]
    const enVoice = pickIrisVoice(voices, localePref)
    // Slightly higher pitch for the en-GB persona adds extra audible separation
    // when only one browser voice is available.
    const pitchAdj = localePref && localePref.toLowerCase() === 'en-gb' ? 1.15 : 1
    console.log('[TTS-fallback] voices:', voices.length, 'locale:', localePref || 'default', 'picked:', enVoice?.name || '(default)')
    const utt = new SpeechSynthesisUtterance(text)
    if (enVoice) utt.voice = enVoice
    utt.rate = 1
    utt.pitch = pitchAdj
    utt.volume = 1
    let started = false
    // Pass { browserFallback: true } so the caller (VoiceChat) can skip its
    // msedge-tts-tuned caption animation, which drifts out of sync with the
    // browser's actual speech pacing.
    utt.onstart = () => { started = true; onStart?.({ browserFallback: true }) }
    utt.onend = () => {
      if (currentBrowserUtterance === utt) currentBrowserUtterance = null
      onEnd?.()
    }
    utt.onerror = (e) => {
      if (currentBrowserUtterance === utt) currentBrowserUtterance = null
      if (e.error !== 'canceled' && e.error !== 'interrupted') onError?.(e)
    }
    // Chrome sometimes leaves synth paused after cancel(); resume() first.
    try { if (window.speechSynthesis.paused) window.speechSynthesis.resume() } catch {}
    currentBrowserUtterance = utt
    window.speechSynthesis.speak(utt)
    // Silent-drop safety: if onstart hasn't fired within 1.5s and nothing else
    // is queued, treat as failure.
    setTimeout(() => {
      if (started) return
      if (window.speechSynthesis.pending || window.speechSynthesis.speaking) return
      onError?.(new Error('BROWSER_TTS_SILENT_DROP'))
    }, 1500)
    return true
  } catch (e) {
    onError?.(e)
    return false
  }
}

// Call inside a user gesture (button click) to pre-unlock HTMLAudioElement autoplay.
// Chrome blocks audio.play() unless the page has had a user interaction; calling this
// inside a click handler ensures all subsequent plays are allowed.
export function unlockAudio() {
  if (audioUnlocked) return
  try {
    // Shortest valid WAV: 44-byte header + 1 silent sample
    const silent = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAAABkYXRhAAAAAA=='
    const a = new Audio(silent)
    const p = a.play()
    if (p) p.then(() => { a.pause(); audioUnlocked = true }).catch(() => {})
    else { a.pause(); audioUnlocked = true }
  } catch {}
}

function isMSESupported() {
  if (typeof window === 'undefined') return false
  if (!('MediaSource' in window)) return false
  try { return MediaSource.isTypeSupported('audio/mpeg') } catch { return false }
}

export async function playServerTTS(text, { voice, onStart, onEnd, onError } = {}) {
  stopServerTTS()

  // Prefer Web Audio API — controlled by the AudioContext that primeTTS() resumes
  // inside the user gesture, so playback is reliable and onStart fires only when
  // audio actually plays. (The MediaSource streaming path was tried as primary for
  // lower latency, but when <audio>.play() was blocked/stalled it fired onError
  // while the caption still showed the full question — "text she hasn't read".
  // Correctness wins: Web Audio is the known-good default.)
  const ctx = getAudioContext()
  if (ctx) {
    await _playWebAudio(text, { voice, ctx, onStart, onEnd, onError })
    return
  }

  if (isMSESupported()) {
    await _playStreaming(text, { voice, onStart, onEnd, onError })
  } else {
    await _playBlob(text, { voice, onStart, onEnd, onError })
  }
}

async function _playWebAudio(text, { voice, ctx, onStart, onEnd, onError } = {}) {
  if (ctx.state === 'suspended') {
    try { await ctx.resume() } catch (e) { onError?.(e); return }
  }

  let res
  try {
    res = await fetch('/api/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, voice }),
    })
  } catch (e) {
    console.warn('[TTS] fetch failed, falling back to browser SpeechSynthesis', e)
    speakViaBrowser(text, { onStart, onEnd, onError, voice })
    return
  }
  if (!res.ok) {
    const msg = await res.text().catch(() => '')
    console.warn('[TTS] server error', res.status, msg, '— falling back to browser SpeechSynthesis')
    speakViaBrowser(text, { onStart, onEnd, onError, voice })
    return
  }

  let arrayBuffer
  try { arrayBuffer = await res.arrayBuffer() } catch (e) {
    console.warn('[TTS] arrayBuffer failed', e)
    onError?.(e)
    return
  }

  let audioBuffer
  try { audioBuffer = await ctx.decodeAudioData(arrayBuffer) } catch (e) {
    console.warn('[TTS] decodeAudioData failed — falling back to blob', e)
    // MP3 decode failed; try HTMLAudioElement blob as last resort
    await _playBlobFromArrayBuffer(arrayBuffer, { onStart, onEnd, onError })
    return
  }

  if (ctx.state === 'suspended') { try { await ctx.resume() } catch {} }

  const source = ctx.createBufferSource()
  source.buffer = audioBuffer
  source.connect(ctx.destination)
  source.onended = () => { currentAudio = null; onEnd?.() }
  // Store so stopServerTTS() can stop it
  currentAudio = { _isWebAudio: true, pause() { try { source.stop() } catch {} }, src: '' }
  source.start(0)
  onStart?.()
}

async function _playBlobFromArrayBuffer(arrayBuffer, { onStart, onEnd, onError } = {}) {
  const blob = new Blob([arrayBuffer], { type: 'audio/mpeg' })
  const url = URL.createObjectURL(blob)
  const audio = new Audio(url)
  audio.preload = 'auto'
  currentAudio = audio
  audio.onplay = () => onStart?.()
  audio.onended = () => { URL.revokeObjectURL(url); if (currentAudio === audio) currentAudio = null; onEnd?.() }
  audio.onerror = (e) => { URL.revokeObjectURL(url); if (currentAudio === audio) currentAudio = null; onError?.(audio.error || e) }
  try { await audio.play() } catch (e) {
    console.warn('[TTS] audio.play() rejected:', e.message)
    URL.revokeObjectURL(url)
    if (currentAudio === audio) currentAudio = null
    onError?.(e)
  }
}

async function _playStreaming(text, { voice, onStart, onEnd, onError } = {}) {
  const ms = new MediaSource()
  currentMediaSource = ms
  const objectUrl = URL.createObjectURL(ms)
  const audio = new Audio(objectUrl)
  currentAudio = audio

  audio.onended = () => {
    if (currentAudio === audio) currentAudio = null
    if (currentMediaSource === ms) currentMediaSource = null
    onEnd?.()
  }
  audio.onerror = () => {
    if (currentAudio === audio) currentAudio = null
    if (currentMediaSource === ms) currentMediaSource = null
    onError?.(audio.error)
  }

  // Wait for MediaSource to open before we can add a SourceBuffer
  await new Promise((resolve) => ms.addEventListener('sourceopen', resolve, { once: true }))
  URL.revokeObjectURL(objectUrl)

  if (currentAudio !== audio) return // stopped before sourceopen

  let sb
  try {
    sb = ms.addSourceBuffer('audio/mpeg')
  } catch (e) {
    // addSourceBuffer can throw if the MediaSource was closed (e.g. stop() called)
    onError?.(e)
    return
  }

  const queue = []
  let appending = false
  let fetchDone = false
  let started = false

  function flushQueue() {
    if (appending || !sb || sb.updating || ms.readyState !== 'open') return
    if (queue.length === 0) {
      if (fetchDone) {
        try { ms.endOfStream() } catch {}
      }
      return
    }
    appending = true
    try {
      sb.appendBuffer(queue.shift())
    } catch (e) {
      appending = false
      console.warn('[TTS] appendBuffer error:', e)
    }
  }

  sb.addEventListener('updateend', () => {
    appending = false
    // Try starting playback as soon as we have any buffered data
    if (!started && audio.readyState >= 2 /* HAVE_CURRENT_DATA */) {
      started = true
      audio.play()
        .then(() => onStart?.())
        .catch((e) => {
          console.warn('[TTS] play() rejected:', e.message)
          onError?.(e)
        })
    }
    flushQueue()
  })

  // Fallback: canplay fires when browser is confident it can play
  audio.addEventListener('canplay', () => {
    if (!started) {
      started = true
      audio.play()
        .then(() => onStart?.())
        .catch((e) => {
          console.warn('[TTS] canplay play() rejected:', e.message)
          onError?.(e)
        })
    }
  }, { once: true })

  try {
    const res = await fetch('/api/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, voice }),
    })
    if (!res.ok) {
      const err = await res.text().catch(() => '')
      console.warn('[TTS] server error', res.status, err, '— falling back to browser SpeechSynthesis')
      speakViaBrowser(text, { onStart, onEnd, onError, voice })
      return
    }

    const reader = res.body.getReader()
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      if (currentAudio !== audio) return // stopped mid-stream
      queue.push(value)
      flushQueue()
    }
    fetchDone = true
    flushQueue()
  } catch (e) {
    if (currentAudio === audio) {
      console.warn('[TTS] stream error, falling back to browser SpeechSynthesis', e)
      speakViaBrowser(text, { onStart, onEnd, onError, voice })
    }
  }
}

async function _playBlob(text, { voice, onStart, onEnd, onError } = {}) {
  let res
  try {
    res = await fetch('/api/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, voice }),
    })
  } catch (e) {
    console.warn('[TTS] fetch failed, falling back to browser SpeechSynthesis', e)
    speakViaBrowser(text, { onStart, onEnd, onError, voice })
    return
  }
  if (!res.ok) {
    const err = await res.text().catch(() => '')
    console.warn('[TTS] server error', res.status, err, '— falling back to browser SpeechSynthesis')
    speakViaBrowser(text, { onStart, onEnd, onError, voice })
    return
  }

  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  const audio = new Audio(url)
  audio.preload = 'auto'
  currentAudio = audio

  audio.onplay = () => onStart?.()
  audio.onended = () => {
    URL.revokeObjectURL(url)
    if (currentAudio === audio) currentAudio = null
    onEnd?.()
  }
  audio.onerror = (e) => {
    URL.revokeObjectURL(url)
    if (currentAudio === audio) currentAudio = null
    onError?.(audio.error || e)
  }

  try {
    await audio.play()
  } catch (e) {
    console.warn('[TTS] audio.play() rejected:', e.message)
    URL.revokeObjectURL(url)
    if (currentAudio === audio) currentAudio = null
    onError?.(e)
  }
}

export function stopServerTTS() {
  if (currentAudio) {
    try { currentAudio.pause() } catch {}
    try { currentAudio.src = '' } catch {}
    currentAudio = null
  }
  if (currentMediaSource) {
    try { if (currentMediaSource.readyState === 'open') currentMediaSource.endOfStream() } catch {}
    currentMediaSource = null
  }
  // Browser SpeechSynthesis fallback — cancel any in-flight utterance too.
  if (currentBrowserUtterance) {
    try { if (typeof window !== 'undefined' && window.speechSynthesis) window.speechSynthesis.cancel() } catch {}
    currentBrowserUtterance = null
  }
}
