export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import { getSupabaseServer } from '@/lib/supabase/server'
import { query } from '@/lib/db'
import DashboardJobsBoard from './DashboardJobsBoard'

// Candidate "Apply" workspace — lives INSIDE the dashboard (separate from the
// public /jobs marketing page). Data fetched on the server; the board handles
// search / sort / domain filter / pagination client-side.
export default async function DashboardJobsPage() {
  const supabase = getSupabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login?next=/dashboard/jobs')

  const [profileRes, jobsRes, doneRes] = await Promise.all([
    query('SELECT (resume_text IS NOT NULL) AS has_resume FROM user_profiles WHERE user_id = $1 LIMIT 1', [user.id]).catch(() => null),
    query('SELECT id, title, role, description, slug, created_at FROM interview_jobs WHERE is_active = true ORDER BY created_at DESC').catch(() => null),
    query('SELECT DISTINCT job_id FROM interview_candidates WHERE user_id = $1', [user.id]).catch(() => null),
  ])

  const hasResume = !!profileRes?.rows?.[0]?.has_resume
  // Serialize created_at to a plain string for the client component.
  const jobs = (jobsRes?.rows || []).map((j) => ({
    id: j.id, title: j.title, role: j.role, slug: j.slug,
    created_at: j.created_at ? new Date(j.created_at).toISOString() : null,
  }))
  const doneJobIds = (doneRes?.rows || []).map((r) => r.job_id)

  return <DashboardJobsBoard jobs={jobs} hasResume={hasResume} doneJobIds={doneJobIds} />
}
