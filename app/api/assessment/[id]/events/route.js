import { NextResponse } from 'next/server'
import { currentUser, errorResponse, TOKEN_HEADER } from '@/lib/written-api'
import { loadSession, canAccess, recordIntegrityEvents, AssessmentError } from '@/lib/written-assessment'

export const dynamic = 'force-dynamic'

// POST /api/assessment/[id]/events   Body: { events: [{ kind, itemId, ms, chars }], token? }
// Integrity signals from the candidate's browser (leaving the tab or window,
// pasting, copying). The token may come in the body because the browser's
// last flush on page close (sendBeacon) cannot set headers.
export async function POST(req, { params }) {
  try {
    const body = await req.json().catch(() => ({}))
    const session = await loadSession(params.id)
    const { user } = await currentUser()
    const token = req.headers.get(TOKEN_HEADER) || body.token
    if (!canAccess(session, { token, userId: user?.id })) {
      throw new AssessmentError('you do not have access to this assessment', 403, 'forbidden')
    }
    return NextResponse.json(await recordIntegrityEvents(session, body.events))
  } catch (e) {
    return errorResponse(e, 'assessment/events')
  }
}
