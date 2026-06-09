import { NextResponse } from 'next/server'
import { getSupabaseServer } from '@/lib/supabase/server'
import { query } from '@/lib/db'

export const dynamic = 'force-dynamic'

// Companies-only: fetches one candidate's full profile (name, email-equivalent via auth, resume text)
// plus their interview history. The detail page renders this.
export async function GET(_req, { params }) {
  const supabase = getSupabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const { rows: roleRows } = await query(`SELECT account_type FROM user_profiles WHERE user_id = $1`, [user.id])
  if (roleRows[0]?.account_type !== 'company') {
    return NextResponse.json({ error: 'Company access only' }, { status: 403 })
  }

  const { id: candidateUserId } = params
  const { rows: profRows } = await query(
    `SELECT user_id, full_name, resume_text, resume_filename, resume_pages, resume_chars, resume_uploaded_at
     FROM user_profiles WHERE user_id = $1 AND account_type = 'candidate'`,
    [candidateUserId]
  )
  if (profRows.length === 0) return NextResponse.json({ error: 'Candidate not found' }, { status: 404 })

  // Interview history — for this candidate, show only the jobs owned by the
  // current company (privacy: don't leak other companies' interviews).
  const { rows: interviews } = await query(
    `SELECT ic.id, ic.name, ic.job_fit_score, ic.fit_reasoning, ic.decision, ic.created_at,
            ij.id AS job_id, ij.title AS job_title, ij.role AS job_role
     FROM interview_candidates ic
     JOIN interview_jobs ij ON ij.id = ic.job_id
     WHERE ic.user_id = $1 AND ij.owner_id = $2
     ORDER BY ic.created_at DESC`,
    [candidateUserId, user.id]
  )

  return NextResponse.json({
    candidate: profRows[0],
    interviews,
  })
}
