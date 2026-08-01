export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getSupabaseServer } from '@/lib/supabase/server'
import { query } from '@/lib/db'
import DomainExpertExperience from '@/components/DomainExpertExperience'

export default async function DomainExpertPage() {
  const supabase = getSupabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login?next=/dashboard/domain-expert')

  const profileRes = await query(
    'SELECT full_name, resume_text FROM user_profiles WHERE user_id = $1 LIMIT 1',
    [user.id]
  ).catch(() => null)
  const profile = profileRes?.rows?.[0] || null
  const hasResume = !!(profile?.resume_text && profile.resume_text.trim().length >= 50)

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl md:text-4xl font-black tracking-tight text-slate-900">Expert Interview</h1>
        <p className="text-slate-500 mt-2 max-w-2xl">
          A ~30-minute voice interview with Maya. She reads your resume, then explores your real depth in your field —
          starting with an introduction and moving into the specifics of your work.
        </p>
      </div>

      {hasResume ? (
        <DomainExpertExperience userProfile={profile} />
      ) : (
        <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center max-w-xl mx-auto shadow-sm">
          <div className="w-14 h-14 mx-auto mb-5 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center">
            <svg className="w-7 h-7 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-slate-900 mb-1">Upload your resume first</h2>
          <p className="text-slate-500 mb-6 max-w-sm mx-auto">
            Maya builds the interview around your actual experience, so we need your resume on file before you start.
          </p>
          <Link
            href="/dashboard/profile?tab=resume"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold transition-colors"
          >
            Upload Resume →
          </Link>
        </div>
      )}
    </div>
  )
}
