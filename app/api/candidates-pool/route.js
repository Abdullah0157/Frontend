import { NextResponse } from 'next/server'
import { getSupabaseServer } from '@/lib/supabase/server'
import { query } from '@/lib/db'

export const dynamic = 'force-dynamic'

// Companies-only: lists all candidates who've completed onboarding (uploaded a resume).
// Returns just the metadata for the list view; the detail page fetches resume text.
export async function GET() {
  const supabase = getSupabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const { rows: roleRows } = await query(`SELECT account_type FROM user_profiles WHERE user_id = $1`, [user.id])
  if (roleRows[0]?.account_type !== 'company') {
    return NextResponse.json({ error: 'Company access only' }, { status: 403 })
  }

  const { rows: candidates } = await query(
    `SELECT
       up.user_id,
       up.full_name,
       up.resume_filename,
       up.resume_pages,
       up.resume_chars,
       up.resume_uploaded_at,
       (
         SELECT COUNT(*)::int FROM interview_candidates ic WHERE ic.user_id = up.user_id
       ) AS interview_count,
       (
         SELECT MAX(ic.job_fit_score) FROM interview_candidates ic WHERE ic.user_id = up.user_id
       ) AS top_fit_score
     FROM user_profiles up
     WHERE up.account_type = 'candidate'
       AND up.resume_text IS NOT NULL
     ORDER BY up.resume_uploaded_at DESC NULLS LAST`
  )
  return NextResponse.json({ candidates })
}
