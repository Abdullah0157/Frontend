import { NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { apiUser, ROLES } from '@/lib/roles'

export const dynamic = 'force-dynamic'

export async function GET(_req, { params }) {
  try {
    const { id } = params
    // This lists every applicant's report, so only the company that owns the
    // job (or a super admin) may read it. Jobs with no owner are admin only.
    const { user, role, response } = await apiUser(ROLES.COMPANY, ROLES.SUPER_ADMIN)
    if (response) return response
    if (!/^[0-9a-f-]{36}$/i.test(String(id))) return NextResponse.json({ error: 'Job not found' }, { status: 404 })

    const jobRes = await query(`SELECT * FROM interview_jobs WHERE id = $1`, [id])
    if (jobRes.rowCount === 0) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 })
    }
    const job = jobRes.rows[0]
    if (role !== ROLES.SUPER_ADMIN && job.owner_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    const candidatesRes = await query(
      `SELECT id, name, email, report, job_fit_score, fit_reasoning, decision, created_at
       FROM interview_candidates
       WHERE job_id = $1
       ORDER BY job_fit_score DESC NULLS LAST, created_at DESC`,
      [id]
    )
    // Written assessment results for this job (one row per finished attempt).
    const writtenRes = await query(
      `SELECT s.id AS session_id, s.candidate_user_id, s.language, s.seniority_band, s.track,
              s.state, s.completed_at, p.full_name,
              r.overall_score, r.band, r.integrity->>'level' AS integrity_level
       FROM assessment_sessions s
       LEFT JOIN user_profiles p ON p.user_id = s.candidate_user_id
       LEFT JOIN assessment_reports r ON r.session_id = s.id
       WHERE s.job_id = $1 AND s.form IS NOT NULL AND s.state IN ('submitted','completed')
       ORDER BY r.overall_score DESC NULLS LAST, s.completed_at DESC`,
      [id]
    ).catch(() => ({ rows: [] }))
    return NextResponse.json({ job, candidates: candidatesRes.rows, writtenAssessments: writtenRes.rows })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
