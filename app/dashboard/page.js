export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import { getSupabaseServer } from '@/lib/supabase/server'
import { query } from '@/lib/db'
import DashboardHome from './DashboardHome'

export default async function DashboardOverview() {
  const supabase = getSupabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login?next=/dashboard')

  const [profileRes, interviewsRes, appsRes, expertRes] = await Promise.all([
    query('SELECT full_name, (resume_text IS NOT NULL) AS has_resume FROM user_profiles WHERE user_id = $1 LIMIT 1', [user.id]).catch(() => null),
    query(
      `SELECT ic.id, ic.created_at, ic.report, ic.job_fit_score,
              ij.title AS job_title, ij.role AS job_role, ij.slug AS job_slug
       FROM interview_candidates ic
       JOIN interview_jobs ij ON ij.id = ic.job_id
       WHERE ic.user_id = $1 ORDER BY ic.created_at DESC LIMIT 20`,
      [user.id]
    ).catch(() => null),
    query(
      `SELECT ja.id, ja.status, ja.submitted_at, ja.created_at,
              ij.title AS job_title, ij.role AS job_role, ij.slug AS job_slug
       FROM job_applications ja
       JOIN interview_jobs ij ON ij.id = ja.job_id
       WHERE ja.candidate_user_id = $1 ORDER BY ja.created_at DESC LIMIT 20`,
      [user.id]
    ).catch(() => null),
    query(
      `SELECT id, domain, report, expertise_score, expertise_level, created_at
       FROM expert_assessments WHERE candidate_user_id = $1 ORDER BY created_at DESC LIMIT 20`,
      [user.id]
    ).catch(() => null),
  ])

  const profile = profileRes?.rows?.[0] || null
  const interviews = (interviewsRes?.rows || []).map((r) => ({
    id: r.id,
    createdAt: r.created_at,
    score: r.report?.score ?? null,
    recommendation: r.report?.recommendation ?? null,
    jobFit: r.job_fit_score ?? null,
    jobTitle: r.job_title,
    jobRole: r.job_role,
    jobSlug: r.job_slug,
  }))
  const applications = (appsRes?.rows || []).map((r) => ({
    id: r.id,
    status: r.status,
    submittedAt: r.submitted_at,
    createdAt: r.created_at,
    jobTitle: r.job_title,
    jobRole: r.job_role,
    jobSlug: r.job_slug,
  }))
  const expertAssessments = (expertRes?.rows || []).map((r) => ({
    id: r.id,
    domain: r.domain,
    report: r.report,
    score: r.expertise_score,
    level: r.expertise_level,
    createdAt: r.created_at,
  }))

  return (
    <DashboardHome
      firstName={profile?.full_name?.split(' ')[0] || null}
      fullName={profile?.full_name || null}
      email={user.email}
      hasResume={!!profile?.has_resume}
      interviews={interviews}
      applications={applications}
      expertAssessments={expertAssessments}
    />
  )
}
