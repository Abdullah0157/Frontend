import { NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { getUserWithRole, ROLES } from '@/lib/roles'
import { AssessmentError } from '@/lib/written-assessment'
import { errorResponse } from '@/lib/written-api'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET /api/company/written-reports/[sessionId]/audio/[audioId]
// A candidate's recorded answer, for the company that owns the job (or a
// super admin). Recordings are deleted after 90 days.
export async function GET(_req, { params }) {
  try {
    const { user, role } = await getUserWithRole()
    if (!user) throw new AssessmentError('not authenticated', 401, 'login_required')
    const { rows } = await query(
      `SELECT a.mime, a.bytes, j.owner_id
       FROM assessment_audio a
       JOIN assessment_sessions s ON s.id = a.session_id
       LEFT JOIN interview_jobs j ON j.id = s.job_id
       WHERE a.id = $1 AND a.session_id = $2 AND a.kind = 'answer'`,
      [params.audioId, params.sessionId]
    )
    if (!rows[0]) throw new AssessmentError('recording not found (they are deleted after 90 days)', 404, 'not_found')
    const allowed = role === ROLES.SUPER_ADMIN || (role === ROLES.COMPANY && rows[0].owner_id === user.id)
    if (!allowed) throw new AssessmentError('you do not have access to this recording', 403, 'forbidden')
    return new NextResponse(rows[0].bytes, { headers: { 'Content-Type': rows[0].mime, 'Cache-Control': 'private, no-store' } })
  } catch (e) {
    return errorResponse(e, 'company/written-reports/audio')
  }
}
