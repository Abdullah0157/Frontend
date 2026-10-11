import { NextResponse } from 'next/server'
import { getUserWithRole, ROLES } from '@/lib/roles'
import { suggestAssessment } from '@/lib/assessment-blueprint'

export const dynamic = 'force-dynamic'

// POST /api/jobs/suggest-assessment   Body: { title, role, description }
// Suggests the written test (track, level, languages) for a job, with the
// reasons, so the company can confirm or change it before saving the job.
export async function POST(req) {
  const { user, role } = await getUserWithRole().catch(() => ({}))
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  if (role !== ROLES.COMPANY && role !== ROLES.SUPER_ADMIN) {
    return NextResponse.json({ error: 'Company access only' }, { status: 403 })
  }
  const body = await req.json().catch(() => ({}))
  return NextResponse.json(suggestAssessment({
    title: String(body.title || '').slice(0, 300),
    role: String(body.role || '').slice(0, 300),
    description: String(body.description || '').slice(0, 20000),
  }))
}
