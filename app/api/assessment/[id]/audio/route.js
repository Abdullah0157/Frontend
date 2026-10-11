import { NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { logEvent } from '@/lib/assessment'
import { authorizedSession, errorResponse } from '@/lib/written-api'
import { getState, AssessmentError } from '@/lib/written-assessment'
import { promptAudio } from '@/lib/speech'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET /api/assessment/[id]/audio?itemId=...
// The audio for the CURRENT English item (a listening clip or a spoken
// prompt). The script itself never reaches the browser. Each item can be
// played a limited number of times (listening twice, "repeat" once).
export async function GET(req, { params }) {
  try {
    const { session } = await authorizedSession(req, params.id)
    const itemId = new URL(req.url).searchParams.get('itemId')
    const state = await getState(session)
    if (state.status !== 'in_progress' || state.item?.id !== itemId) {
      throw new AssessmentError('audio is only available for the current question', 409, 'not_current')
    }
    const { rows } = await query(`SELECT type, content, scoring_rubric FROM items WHERE id = $1`, [itemId])
    const item = rows[0]
    const lines = item?.scoring_rubric?.audio?.lines
    if (!lines?.length) throw new AssessmentError('this question has no audio', 404, 'no_audio')
    const plays = item.content?.plays || (item.type === 'listening' ? 2 : 1)
    const { rows: used } = await query(
      `SELECT COUNT(*)::int AS n FROM assessment_events WHERE session_id = $1 AND type = 'audio_play' AND payload->>'itemId' = $2`,
      [session.id, itemId]
    )
    if (used[0].n >= plays) throw new AssessmentError(`this audio can be played ${plays === 1 ? 'once' : `${plays} times`}`, 429, 'play_limit')
    const audio = await promptAudio(lines)
    await logEvent(session.id, 'audio_play', { itemId, play: used[0].n + 1 }, 'candidate')
    return new NextResponse(audio.bytes, {
      headers: { 'Content-Type': audio.mime, 'Cache-Control': 'no-store', 'X-Plays-Left': String(plays - used[0].n - 1) },
    })
  } catch (e) {
    return errorResponse(e, 'assessment/audio')
  }
}
