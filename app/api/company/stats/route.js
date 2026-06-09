import { NextResponse } from 'next/server'
import { getSupabaseServer } from '@/lib/supabase/server'
import { query } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET() {
  const supabase = getSupabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const { rows: roleRows } = await query(`SELECT account_type FROM user_profiles WHERE user_id = $1`, [user.id])
  if (roleRows[0]?.account_type !== 'company') {
    return NextResponse.json({ error: 'Company access only' }, { status: 403 })
  }

  // Aggregate stats for this company's jobs only
  const { rows: stats } = await query(
    `WITH owned AS (SELECT id FROM interview_jobs WHERE owner_id = $1)
     SELECT
       (SELECT COUNT(*)::int FROM owned) AS active_jobs,
       (SELECT COUNT(*)::int FROM interview_candidates WHERE job_id IN (SELECT id FROM owned)) AS total_candidates,
       (SELECT COUNT(*)::int FROM interview_candidates WHERE job_id IN (SELECT id FROM owned) AND decision = 'hire') AS hired_count,
       (SELECT COUNT(*)::int FROM interview_candidates WHERE job_id IN (SELECT id FROM owned) AND decision = 'pending') AS pending_decisions,
       (SELECT COUNT(*)::int FROM interview_candidates WHERE job_id IN (SELECT id FROM owned) AND decision = 'reject') AS rejected_count,
       (SELECT AVG(job_fit_score)::int FROM interview_candidates WHERE job_id IN (SELECT id FROM owned) AND job_fit_score IS NOT NULL) AS avg_fit_score`,
    [user.id]
  )

  // Top jobs by candidate count (max 5)
  const { rows: topJobs } = await query(
    `SELECT j.id, j.slug, j.title, j.role,
            COUNT(c.id)::int AS candidate_count,
            MAX(c.job_fit_score) AS top_fit
     FROM interview_jobs j
     LEFT JOIN interview_candidates c ON c.job_id = j.id
     WHERE j.owner_id = $1
     GROUP BY j.id
     ORDER BY candidate_count DESC, j.created_at DESC
     LIMIT 5`,
    [user.id]
  )

  // Recent candidates (last 5)
  const { rows: recentCandidates } = await query(
    `SELECT c.id, c.name, c.email, c.job_fit_score, c.decision, c.created_at,
            j.id AS job_id, j.title AS job_title
     FROM interview_candidates c
     JOIN interview_jobs j ON j.id = c.job_id
     WHERE j.owner_id = $1
     ORDER BY c.created_at DESC
     LIMIT 5`,
    [user.id]
  )

  // Activity last 30 days (candidates per day)
  const { rows: activity } = await query(
    `SELECT DATE(c.created_at) AS day, COUNT(*)::int AS n
     FROM interview_candidates c
     JOIN interview_jobs j ON j.id = c.job_id
     WHERE j.owner_id = $1 AND c.created_at > now() - interval '30 days'
     GROUP BY DATE(c.created_at)
     ORDER BY day`,
    [user.id]
  )

  return NextResponse.json({
    stats: stats[0] || {},
    topJobs,
    recentCandidates,
    activity,
  })
}
