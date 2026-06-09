import { MsEdgeTTS, OUTPUT_FORMAT } from 'msedge-tts'

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

export async function POST(req) {
  let tts
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

    tts = new MsEdgeTTS()
    await tts.setMetadata(useVoice, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3)
    const { audioStream } = tts.toStream(text)

    // Hand ownership of tts to the stream so it's closed after streaming finishes,
    // not in the finally block (which would run before the stream is consumed).
    const ttsInstance = tts
    tts = null

    const readable = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of audioStream) {
            controller.enqueue(chunk)
          }
          controller.close()
        } catch (e) {
          controller.error(e)
        } finally {
          try { ttsInstance.close() } catch {}
        }
      },
    })

    return new Response(readable, {
      status: 200,
      headers: {
        'Content-Type': 'audio/mpeg',
        'Cache-Control': 'no-store',
      },
    })
  } catch (e) {
    console.error('TTS error:', e)
    try { tts?.close() } catch {}
    return new Response(JSON.stringify({ error: e.message || 'TTS failed' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}
