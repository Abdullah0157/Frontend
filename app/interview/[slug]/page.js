import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import InterviewSession from '@/components/InterviewSession'
import { getSupabaseServer } from '@/lib/supabase/server'
import { query } from '@/lib/db'

export const dynamic = 'force-dynamic'

async function fetchJob(slug) {
  const h = headers()
  const host = h.get('host')
  const proto = h.get('x-forwarded-proto') || 'http'
  const res = await fetch(`${proto}://${host}/api/jobs/by-slug/${slug}`, { cache: 'no-store' })
  if (!res.ok) return null
  const { job } = await res.json()
  return job
}

export default async function JobInterviewPage({ params }) {
  const job = await fetchJob(params.slug)

  if (!job) {
    return (
      <div className="min-h-screen pt-32 pb-24 px-4">
        <div className="container mx-auto max-w-2xl text-center">
          <h1 className="text-3xl font-black uppercase text-white mb-4">Interview not found</h1>
          <p className="text-slate-400">The link may be invalid or expired.</p>
        </div>
      </div>
    )
  }

  // Auth gate: middleware already redirects unauthenticated users, but we
  // double-check in case middleware was bypassed.
  const supabase = getSupabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    redirect(`/login?next=${encodeURIComponent(`/interview/${params.slug}`)}`)
  }

  // Pull the candidate's profile (name + resume) so we can skip the intake form.
  const { rows } = await query(
    `SELECT full_name, resume_text FROM user_profiles WHERE user_id = $1`,
    [user.id]
  )
  const profile = rows[0] || {}

  // If they have no resume yet, send them to onboarding first.
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
