import { NextResponse } from 'next/server'
import { getSupabaseServer } from '@/lib/supabase/server'
import { query } from '@/lib/db'

export const dynamic = 'force-dynamic'

// POST /api/applications/submit  Body: { jobId }
// Verifies the candidate has completed ALL of the job's required steps
// (each required assessment + AI interview if required), then marks the
// application submitted. Server-side re-check so the client can't fake it.
export async function POST(req) {
  const supabase = getSupabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const { jobId } = await req.json().catch(() => ({}))
  if (!jobId) return NextResponse.json({ error: 'jobId required' }, { status: 400 })

  const jobRes = await query(
    `SELECT id, required_assessments, requires_ai_interview FROM interview_jobs WHERE id = $1`,
    [jobId]
  )
  if (jobRes.rowCount === 0) return NextResponse.json({ error: 'Job not found' }, { status: 404 })
  const job = jobRes.rows[0]

  // Which required assessments has the candidate completed for this job?
  const doneAssessmentsRes = await query(
    `SELECT DISTINCT role_family FROM assessment_sessions
     WHERE job_id = $1 AND candidate_user_id = $2 AND state IN ('submitted','completed')`,
    [jobId, user.id]
  )
  const doneAssessments = new Set(doneAssessmentsRes.rows.map((r) => r.role_family))
  const missingAssessments = (job.required_assessments || []).filter((a) => !doneAssessments.has(a))

  // AI interview completion.
  let interviewMissing = false
  if (job.requires_ai_interview) {
    const iv = await query(
      `SELECT 1 FROM interview_candidates WHERE job_id = $1 AND user_id = $2 LIMIT 1`,
      [jobId, user.id]
    )
    interviewMissing = iv.rowCount === 0
  }

  // Account-level reused steps: resume + expert interview.
  const [resumeRes, expertRes] = await Promise.all([
    query(`SELECT (resume_text IS NOT NULL) AS has_resume FROM user_profiles WHERE user_id = $1`, [user.id]).catch(() => null),
    query(`SELECT 1 FROM expert_assessments WHERE candidate_user_id = $1 LIMIT 1`, [user.id]).catch(() => null),
  ])
  const resumeMissing = !resumeRes?.rows?.[0]?.has_resume
  const expertMissing = (expertRes?.rowCount || 0) === 0

  if (missingAssessments.length > 0 || interviewMissing || resumeMissing || expertMissing) {
    return NextResponse.json({
      error: 'Requirements incomplete',
      missingAssessments,
      interviewMissing,
      resumeMissing,
      expertMissing,
    }, { status: 400 })
  }

  // All good — mark submitted.
  const { rows } = await query(
    `INSERT INTO job_applications (job_id, candidate_user_id, status, submitted_at)
     VALUES ($1, $2, 'submitted', now())
     ON CONFLICT (job_id, candidate_user_id)
     DO UPDATE SET status = 'submitted', submitted_at = now()
     RETURNING id, status, submitted_at`,
    [jobId, user.id]
  )
  return NextResponse.json({ application: rows[0] })
}
