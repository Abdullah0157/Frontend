// Client-side TTS player. Uses MediaSource API for streaming playback (audio
// starts as soon as the first chunk arrives instead of after the full MP3
// downloads). Falls back to the old blob approach in browsers without MSE
// support for audio/mpeg (e.g. older Safari).

import { getAudioContext } from './tts'

let currentAudio = null
let currentMediaSource = null

function isMSESupported() {
  if (typeof window === 'undefined') return false
  if (!('MediaSource' in window)) return false
  try { return MediaSource.isTypeSupported('audio/mpeg') } catch { return false }
}

export async function playServerTTS(text, { voice, onStart, onEnd, onError } = {}) {
  stopServerTTS()

  // Resume any suspended AudioContext (autoplay policy unlock)
  try {
    const ctx = getAudioContext()
    if (ctx?.state === 'suspended') ctx.resume().catch(() => {})
  } catch {}

  if (isMSESupported()) {
    await _playStreaming(text, { voice, onStart, onEnd, onError })
  } else {
    await _playBlob(text, { voice, onStart, onEnd, onError })
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
      console.warn('[TTS] server error', res.status, err)
      onError?.(new Error(`TTS server returned ${res.status}`))
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
      console.warn('[TTS] stream error', e)
      onError?.(e)
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
    console.warn('[TTS] fetch failed', e)
    onError?.(e)
    return
  }
  if (!res.ok) {
    const err = await res.text().catch(() => '')
    console.warn('[TTS] server error', res.status, err)
    onError?.(new Error(`TTS server returned ${res.status}`))
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
}
