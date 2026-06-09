import { NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { getSupabaseServer } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET(_req, { params }) {
  try {
    const { id } = params
    const supabase = getSupabaseServer()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

    // Owner check: company can only see their own jobs.
    const jobRes = await query(`SELECT * FROM interview_jobs WHERE id = $1`, [id])
    if (jobRes.rowCount === 0) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 })
    }
    const job = jobRes.rows[0]
    if (job.owner_id && job.owner_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    const candidatesRes = await query(
      `SELECT id, name, email, report, job_fit_score, fit_reasoning, decision, created_at
       FROM interview_candidates
       WHERE job_id = $1
       ORDER BY job_fit_score DESC NULLS LAST, created_at DESC`,
      [id]
    )
    return NextResponse.json({ job, candidates: candidatesRes.rows })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
