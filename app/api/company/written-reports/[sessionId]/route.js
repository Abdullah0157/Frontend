import { NextResponse } from 'next/server'
import { getUserWithRole, ROLES } from '@/lib/roles'
import { companyReport, AssessmentError } from '@/lib/written-assessment'
import { errorResponse } from '@/lib/written-api'

export const dynamic = 'force-dynamic'

// GET /api/company/written-reports/[sessionId]
// The full written-assessment report for a hiring team: only the company that
// owns the job the test was taken for (or a super admin) may read it.
export async function GET(_req, { params }) {
  try {
    const { user, role } = await getUserWithRole()
    if (!user) throw new AssessmentError('not authenticated', 401, 'login_required')
    const data = await companyReport(params.sessionId)
    const isAdmin = role === ROLES.SUPER_ADMIN
    const owns = role === ROLES.COMPANY && data.job?.ownerId === user.id
    if (!isAdmin && !owns) throw new AssessmentError('you do not have access to this report', 403, 'forbidden')
    if (data.job) delete data.job.ownerId
    return NextResponse.json(data)
  } catch (e) {
    return errorResponse(e, 'company/written-reports')
  }
}
