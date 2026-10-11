// Speech for the English test: making prompt audio (text to speech) and
// turning candidate recordings into text (speech to text).
//
// Prompt audio: listening clips and spoken prompts are generated on the server
// with Microsoft neural voices in several English accents and cached in the
// database. The script never reaches the browser, only the audio.
// Transcription: Whisper. Groq's hosted Whisper by default (JobStream already
// uses it); set WHISPER_URL to an OpenAI-compatible Whisper server to run it
// on your own machine instead.

import { createHash } from 'node:crypto'
import { synthesize } from './edge-tts.js'
import { query } from './db.js'

const synthesizeLine = (voice, text) => synthesize(voice, text)

// Lines are spoken one after another (same MP3 format, so the segments can be
// joined directly).
export async function synthesizeLines(lines) {
  const parts = []
  for (const [i, l] of lines.entries()) {
    if (i) await new Promise((r) => setTimeout(r, 400)) // gentle on the free voice service
    parts.push(await synthesizeLine(l.voice, l.text))
  }
  return Buffer.concat(parts)
}

export function audioHash(lines) {
  return createHash('sha256').update(JSON.stringify(lines.map((l) => [l.voice, l.text]))).digest('hex')
}

export async function promptAudio(lines) {
  const hash = audioHash(lines)
  const { rows } = await query(`SELECT mime, bytes FROM item_audio_cache WHERE content_hash = $1`, [hash])
  if (rows[0]) return { mime: rows[0].mime, bytes: rows[0].bytes }
  const bytes = await synthesizeLines(lines)
  await query(
    `INSERT INTO item_audio_cache (content_hash, mime, bytes) VALUES ($1, 'audio/mpeg', $2) ON CONFLICT (content_hash) DO NOTHING`,
    [hash, bytes]
  )
  return { mime: 'audio/mpeg', bytes }
}

// ── Speech to text ────────────────────────────────────────────────────────

const EXT = { 'audio/webm': 'webm', 'audio/ogg': 'ogg', 'audio/mpeg': 'mp3', 'audio/mp4': 'm4a', 'audio/wav': 'wav', 'audio/x-wav': 'wav' }

// Returns { text, segments: [{start, end, text, avg_logprob, no_speech_prob}], duration }.
export async function transcribe(bytes, mime = 'audio/webm', { prompt = '' } = {}) {
  const base = (mime || '').split(';')[0]
  const form = new FormData()
  form.append('file', new Blob([bytes], { type: base }), `answer.${EXT[base] || 'webm'}`)
  form.append('model', process.env.WHISPER_MODEL || 'whisper-large-v3-turbo')
  form.append('language', 'en')
  form.append('response_format', 'verbose_json')
  form.append('temperature', '0')
  if (prompt) form.append('prompt', String(prompt).slice(0, 800))
  const url = process.env.WHISPER_URL
    ? `${process.env.WHISPER_URL.replace(/\/$/, '')}/v1/audio/transcriptions`
    : 'https://api.groq.com/openai/v1/audio/transcriptions'
  const headers = process.env.WHISPER_URL ? {} : { Authorization: `Bearer ${process.env.GROQ_API_KEY}` }
  const res = await fetch(url, { method: 'POST', headers, body: form, signal: AbortSignal.timeout(60000) })
  if (!res.ok) throw new Error(`speech to text failed (${res.status}): ${(await res.text()).slice(0, 200)}`)
  const data = await res.json()
  return {
    text: String(data.text || '').trim(),
    segments: (data.segments || []).map((s) => ({
      start: s.start, end: s.end, text: s.text, avg_logprob: s.avg_logprob, no_speech_prob: s.no_speech_prob,
    })),
    duration: data.duration ?? null,
  }
}
