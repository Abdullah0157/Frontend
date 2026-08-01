import { redirect } from 'next/navigation'
import { getSupabaseServer } from '@/lib/supabase/server'
import { query } from '@/lib/db'
import CandidatePoolList from './CandidatePoolList'

export const dynamic = 'force-dynamic'

// Server-rendered: auth + data fetch happen on the server so the page arrives
// already populated (the route's loading.js covers the wait). No client fetch
// waterfall. Companies only.
export default async function CandidatePoolPage() {
  const supabase = getSupabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login?next=/company/candidates')

  const { rows: roleRows } = await query(
    `SELECT account_type FROM user_profiles WHERE user_id = $1`, [user.id]
  ).catch(() => ({ rows: [] }))
  if (roleRows[0]?.account_type !== 'company') redirect('/company')

  const { rows: candidates } = await query(
    `SELECT
       up.user_id, up.full_name, up.resume_filename, up.resume_pages,
       up.resume_chars, up.resume_uploaded_at,
       (SELECT COUNT(*)::int FROM interview_candidates ic WHERE ic.user_id = up.user_id) AS interview_count,
       (SELECT MAX(ic.job_fit_score) FROM interview_candidates ic WHERE ic.user_id = up.user_id) AS top_fit_score
     FROM user_profiles up
     WHERE up.account_type = 'candidate' AND up.resume_text IS NOT NULL
     ORDER BY up.resume_uploaded_at DESC NULLS LAST`
  ).catch(() => ({ rows: [] }))

  return <CandidatePoolList candidates={candidates} />
}
