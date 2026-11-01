import { NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { apiUser, ROLES } from '@/lib/roles'
import { attemptStatus } from '@/lib/interview-record'

export const dynamic = 'force-dynamic'

const UUID = /^[0-9a-f-]{36}$/i

// POST { userId, jobId? }: gives a candidate one more interview attempt, for a
// real technical problem. No jobId = the expert interview (Maya); a jobId = the
// AI interview (Iris) for that job. Admin only.
export async function POST(req) {
  const { user, response } = await apiUser(ROLES.SUPER_ADMIN)
  if (response) return response
  const { userId, jobId = null } = await req.json().catch(() => ({}))
  if (!UUID.test(String(userId || ''))) return NextResponse.json({ error: 'Candidate not found.' }, { status: 404 })
  if (jobId != null && !UUID.test(String(jobId))) return NextResponse.json({ error: 'Job not found.' }, { status: 404 })

  const { rows: who } = await query(`SELECT 1 FROM user_profiles WHERE user_id = $1 AND COALESCE(account_type, 'candidate') = 'candidate'`, [userId])
  if (!who[0]) return NextResponse.json({ error: 'Candidate not found.' }, { status: 404 })
  if (jobId) {
    const { rows: job } = await query(`SELECT 1 FROM interview_jobs WHERE id = $1`, [jobId])
    if (!job[0]) return NextResponse.json({ error: 'Job not found.' }, { status: 404 })
  }
  await query(
    `INSERT INTO interview_attempt_grants (user_id, job_id, granted_by) VALUES ($1, $2, $3)`,
    [userId, jobId, user.id]
  )
  return NextResponse.json({ attempts: await attemptStatus(userId, jobId) })
}
