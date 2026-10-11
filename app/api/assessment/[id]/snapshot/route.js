import { NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { currentUser, errorResponse, TOKEN_HEADER } from '@/lib/written-api'
import { loadSession, canAccess, AssessmentError } from '@/lib/written-assessment'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// POST /api/assessment/[id]/snapshot   Body: { image: base64 JPEG, itemId? }
// A camera photo, taken by the candidate's browser every 30 seconds while a
// question is on screen. Only during the test, JPEG only, small, and no more
// often than every 15 seconds, so the route cannot be used to store anything else.
const MAX_BYTES = 150 * 1024
const MAX_PER_SESSION = 400

export async function POST(req, { params }) {
  try {
    const body = await req.json().catch(() => ({}))
    const session = await loadSession(params.id)
    const { user } = await currentUser()
    if (!canAccess(session, { token: req.headers.get(TOKEN_HEADER), userId: user?.id })) {
      throw new AssessmentError('you do not have access to this assessment', 403, 'forbidden')
    }
    if (session.state !== 'in_progress') return NextResponse.json({ stored: false, reason: 'not in progress' })
    const bytes = Buffer.from(String(body.image || ''), 'base64')
    const isJpeg = bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
    if (!isJpeg || bytes.length > MAX_BYTES) throw new AssessmentError('a small JPEG photo is expected', 400, 'bad_image')
    const { rows } = await query(
      `SELECT count(*)::int AS n, max(created_at) > now() - interval '15 seconds' AS recent
       FROM assessment_snapshots WHERE session_id = $1`,
      [session.id]
    )
    if (rows[0].recent || rows[0].n >= MAX_PER_SESSION) return NextResponse.json({ stored: false, reason: 'too soon' })
    const itemIds = new Set(session.form.sections.flatMap((s) => s.items.map((i) => i.itemId)))
    await query(
      `INSERT INTO assessment_snapshots (session_id, item_id, bytes) VALUES ($1, $2, $3)`,
      [session.id, itemIds.has(body.itemId) ? body.itemId : null, bytes]
    )
    return NextResponse.json({ stored: true })
  } catch (e) {
    return errorResponse(e, 'assessment/snapshot')
  }
}
