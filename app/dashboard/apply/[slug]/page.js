import Link from 'next/link'
import { getSupabaseServer } from '@/lib/supabase/server'
import { loadApplication } from '@/lib/application-steps'
import ApplicationHub from '@/components/ApplicationHub'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Application' }

// A job application inside the candidate dashboard: the job and its steps.
// The dashboard layout already requires a logged-in candidate.
export default async function DashboardApplyPage({ params }) {
  const supabase = getSupabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  const app = user ? await loadApplication(params.slug, user.id) : null
  if (!app) {
    return (
      <div className="max-w-2xl rounded-2xl border border-dashed border-slate-300 bg-slate-50/60 px-6 py-14 text-center">
        <h1 className="text-xl font-semibold text-slate-900">Position not found</h1>
        <p className="mt-2 text-slate-500">The link may be invalid or the role may have closed.</p>
        <Link href="/dashboard/jobs" className="mt-6 inline-block text-sm font-semibold text-indigo-600 hover:text-indigo-700">← See open jobs</Link>
      </div>
    )
  }
  return <ApplicationHub {...app} inDashboard />
}
