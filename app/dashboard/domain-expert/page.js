export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import { getSupabaseServer } from '@/lib/supabase/server'
import { query } from '@/lib/db'
import DomainExpertExperience from '@/components/DomainExpertExperience'

export default async function DomainExpertPage() {
  const supabase = getSupabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login?next=/dashboard/domain-expert')

  // NOTE: we do NOT hard-gate on this server read. The client Router Cache can
  // serve a stale version of this render (e.g. one captured before the resume
  // was uploaded), which would wrongly show "upload your resume first" even
  // though it's saved. Instead we always mount the experience and let its LIVE
  // detect-domain POST — which hits the DB fresh and can't be cached — be the
  // single source of truth. This profile is only a first-paint hint.
  const profileRes = await query(
    'SELECT full_name, resume_text FROM user_profiles WHERE user_id = $1 LIMIT 1',
    [user.id]
  ).catch(() => null)
  const profile = profileRes?.rows?.[0] || null

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl md:text-4xl font-black tracking-tight text-slate-900">Expert Interview</h1>
        <p className="text-slate-500 mt-2 max-w-2xl">
          A ~30-minute voice interview with Maya. She reads your resume, then explores your real depth in your field —
          starting with an introduction and moving into the specifics of your work.
        </p>
      </div>

      <DomainExpertExperience userProfile={profile} />
    </div>
  )
}
