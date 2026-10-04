import { NextResponse } from 'next/server'
import { authorizedSession, errorResponse } from '@/lib/written-api'
import { beginSection } from '@/lib/written-assessment'

export const dynamic = 'force-dynamic'

// POST /api/assessment/[id]/begin
// Starts the current section's timer (after the candidate has read the
// section intro) and returns the first item. Safe to call again: if the
// section is already running it just returns the current item.
export async function POST(req, { params }) {
  try {
    const { session } = await authorizedSession(req, params.id)
    return NextResponse.json(await beginSection(session))
  } catch (e) {
    return errorResponse(e, 'assessment/begin')
  }
}
