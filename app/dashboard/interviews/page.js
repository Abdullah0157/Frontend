export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getSupabaseServer } from '@/lib/supabase/server'
import { query } from '@/lib/db'
import InterviewList from './InterviewList'

export default async function DashboardInterviewsPage() {
  const supabase = getSupabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login?next=/dashboard/interviews')

  const res = await query(
    `SELECT ic.id, ic.created_at, ic.report, ic.job_id,
            ij.title AS job_title, ij.role AS job_role
     FROM interview_candidates ic
     JOIN interview_jobs ij ON ij.id = ic.job_id
     WHERE ic.user_id = $1
     ORDER BY ic.created_at DESC`,
    [user.id]
  ).catch(() => null)
  const interviews = res?.rows || []

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 mb-8">
        <h1 className="text-3xl md:text-4xl font-black tracking-tight text-slate-900">My Interviews</h1>
        <span className="text-sm text-slate-400 font-medium">
          {interviews.length} completed
        </span>
      </div>

      {interviews.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50/50 px-6 py-14 text-center">
          <p className="text-slate-500 mb-3">No interviews yet.</p>
          <Link href="/dashboard/jobs" className="text-sm font-bold text-indigo-600 hover:text-indigo-700 underline underline-offset-4">
            Find a job to interview for →
          </Link>
        </div>
      ) : (
        <InterviewList interviews={interviews} />
      )}
    </div>
  )
}
