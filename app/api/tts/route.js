import { synthesize } from '@/lib/edge-tts'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const DEFAULT_VOICE = 'en-US-AriaNeural'
const ALLOWED_VOICES = new Set([
  'en-US-AriaNeural',
  'en-US-JennyNeural',
  'en-US-MichelleNeural',
  'en-US-AvaNeural',
  'en-US-EmmaNeural',
  'en-GB-SoniaNeural',
  'en-GB-LibbyNeural',
  'en-AU-NatashaNeural',
])

const MAX_TEXT = 4000

// Uses our own Edge TTS client (lib/edge-tts.js): the msedge-tts package's
// connection started being refused by the service in October 2026.
export async function POST(req) {
  try {
    const { text, voice } = await req.json()
    if (!text || typeof text !== 'string') {
      return new Response(JSON.stringify({ error: 'text required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }
    if (text.length > MAX_TEXT) {
      return new Response(JSON.stringify({ error: `text too long (>${MAX_TEXT} chars)` }), {
        status: 413,
        headers: { 'Content-Type': 'application/json' },
      })
    }
    const useVoice = ALLOWED_VOICES.has(voice) ? voice : DEFAULT_VOICE
    const audio = await synthesize(useVoice, text)
    return new Response(audio, {
      headers: { 'Content-Type': 'audio/mpeg', 'Cache-Control': 'no-store' },
    })
  } catch (e) {
    console.error('tts error:', e.message)
    return new Response(JSON.stringify({ error: 'Voice is temporarily unavailable' }), {
      status: 502,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}
