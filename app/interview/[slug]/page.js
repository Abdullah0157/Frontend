import { redirect } from 'next/navigation'
import { getSupabaseServer } from '@/lib/supabase/server'
import { loadApplication } from '@/lib/application-steps'
import ApplicationHub from '@/components/ApplicationHub'

export const dynamic = 'force-dynamic'

// The job link companies share. Candidates never stay here: the middleware
// sends them to the same page inside their dashboard (/dashboard/apply/[slug]).
// What remains is the preview a company or the admin sees.
export default async function ApplicationHubPage({ params }) {
  const supabase = getSupabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect(`/login?next=${encodeURIComponent(`/interview/${params.slug}`)}`)

  const app = await loadApplication(params.slug, user.id)
  if (!app) {
    return (
      <div className="min-h-screen pt-32 pb-24 px-4">
        <div className="container mx-auto max-w-2xl text-center">
          <h1 className="text-3xl font-black uppercase text-slate-900 mb-4">Position not found</h1>
          <p className="text-slate-500">The link may be invalid or the role may have closed.</p>
        </div>
      </div>
    )
  }
  return <ApplicationHub {...app} />
}
