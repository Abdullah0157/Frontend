import { NextResponse } from 'next/server'
import { query } from '@/lib/db'

export const dynamic = 'force-dynamic'

const ALLOWED = new Set(['pending', 'hire', 'reject'])

export async function PATCH(req, { params }) {
  try {
    const { id } = params
    const { decision } = await req.json()
    if (!ALLOWED.has(decision)) {
      return NextResponse.json({ error: 'decision must be pending|hire|reject' }, { status: 400 })
    }
    const { rows, rowCount } = await query(
      `UPDATE interview_candidates SET decision = $1 WHERE id = $2
       RETURNING id, decision`,
      [decision, id]
    )
    if (rowCount === 0) return NextResponse.json({ error: 'Candidate not found' }, { status: 404 })
    return NextResponse.json({ candidate: rows[0] })
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
