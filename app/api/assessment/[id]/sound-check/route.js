import { NextResponse } from 'next/server'
import { authorizedSession, errorResponse } from '@/lib/written-api'
import { AssessmentError } from '@/lib/written-assessment'
import { transcribe } from '@/lib/speech'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// POST /api/assessment/[id]/sound-check   Body: { audio: base64, mime }
// Not scored and not stored: checks the microphone and the speech-to-text
// path work before the English test starts, and says what was heard.
export async function POST(req, { params }) {
  try {
    await authorizedSession(req, params.id)
    const body = await req.json().catch(() => ({}))
    if (typeof body.audio !== 'string' || !body.audio || body.audio.length > 1_000_000) {
      throw new AssessmentError('send a short recording', 400, 'bad_audio')
    }
    const tr = await transcribe(Buffer.from(body.audio, 'base64'), String(body.mime || 'audio/webm'))
    const words = tr.text.split(/\s+/).filter(Boolean).length
    return NextResponse.json({ heard: tr.text, ok: words >= 3 })
  } catch (e) {
    return errorResponse(e, 'assessment/sound-check')
  }
}
