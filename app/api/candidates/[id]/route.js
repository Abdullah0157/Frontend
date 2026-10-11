import { NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { apiUser, ROLES } from '@/lib/roles'

export const dynamic = 'force-dynamic'

const ALLOWED = new Set(['pending', 'hire', 'reject'])

// Only the company that owns the candidate's job (or a super admin) may set
// the hiring decision.
export async function PATCH(req, { params }) {
  try {
    const { user, role, response } = await apiUser(ROLES.COMPANY, ROLES.SUPER_ADMIN)
    if (response) return response
    const { id } = params
    if (!/^[0-9a-f-]{36}$/i.test(String(id))) return NextResponse.json({ error: 'Candidate not found' }, { status: 404 })
    const { decision } = await req.json().catch(() => ({}))
    if (!ALLOWED.has(decision)) {
      return NextResponse.json({ error: 'decision must be pending|hire|reject' }, { status: 400 })
    }
    const { rows, rowCount } = await query(
      `UPDATE interview_candidates c SET decision = $1
       FROM interview_jobs j
       WHERE c.id = $2 AND j.id = c.job_id AND ($3::boolean OR j.owner_id = $4)
       RETURNING c.id, c.decision`,
      [decision, id, role === ROLES.SUPER_ADMIN, user.id]
    )
    // Not found and not yours look the same, so ids cannot be probed.
    if (rowCount === 0) return NextResponse.json({ error: 'Candidate not found' }, { status: 404 })
    return NextResponse.json({ candidate: rows[0] })
  } catch (e) {
    console.error('candidates/[id] PATCH error:', e)
    return NextResponse.json({ error: 'Could not save the decision.' }, { status: 500 })
  }
}
