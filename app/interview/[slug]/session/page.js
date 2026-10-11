import { redirect } from 'next/navigation'
import InterviewSession from '@/components/InterviewSession'
import { getSupabaseServer } from '@/lib/supabase/server'
import { query } from '@/lib/db'

export const dynamic = 'force-dynamic'

// The actual AI interview with Iris for a job. Reached from the application
// hub (/interview/[slug]) once the candidate clicks "Start AI Interview".
async function fetchJob(slug) {
  const { rows } = await query(
    `SELECT id, slug, title, role, description, company FROM interview_jobs WHERE slug = $1 AND is_active = true`,
    [slug]
  )
  return rows[0] || null
}

export default async function JobInterviewSessionPage({ params }) {
  const job = await fetchJob(params.slug)
  if (!job) {
    return (
      <div className="min-h-screen pt-32 pb-24 px-4">
        <div className="container mx-auto max-w-2xl text-center">
          <h1 className="text-3xl font-black uppercase text-slate-900 mb-4">Interview not found</h1>
          <p className="text-slate-500">The link may be invalid or expired.</p>
        </div>
      </div>
    )
  }

  const supabase = getSupabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect(`/login?next=${encodeURIComponent(`/interview/${params.slug}/session`)}`)

  const { rows } = await query(
    `SELECT full_name, resume_text FROM user_profiles WHERE user_id = $1`,
    [user.id]
  )
  const profile = rows[0] || {}
  if (!profile.resume_text) {
    redirect(`/profile?onboarding=1&next=${encodeURIComponent(`/interview/${params.slug}`)}`)
  }

  const prefilledCandidate = {
    name: profile.full_name || user.email?.split('@')[0] || 'Candidate',
    email: user.email || '',
  }

  return (
    <InterviewSession
      job={job}
      prefilledCandidate={prefilledCandidate}
      resumeText={profile.resume_text}
    />
  )
}
