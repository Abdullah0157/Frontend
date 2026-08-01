export const revalidate = 300

import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getSupabaseServer } from '@/lib/supabase/server'
import { query } from '@/lib/db'

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
  const jobs = jobsRes?.rows || []
  const doneSet = new Set((doneRes?.rows || []).map((r) => r.job_id))

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 mb-6">
        <h1 className="text-3xl md:text-4xl font-black tracking-tight text-slate-900">Apply to Jobs</h1>
        <span className="text-sm text-slate-400 font-medium">{jobs.length} open role{jobs.length !== 1 ? 's' : ''}</span>
      </div>

      {!hasResume && (
        <Link
          href="/dashboard/profile?tab=resume"
          className="flex items-center justify-between gap-4 px-5 py-3.5 mb-8 rounded-2xl border border-amber-200 bg-amber-50/70 hover:bg-amber-50 transition"
        >
          <p className="text-sm text-amber-800 font-medium">Upload your resume before starting an interview.</p>
          <span className="text-sm font-bold text-amber-800 whitespace-nowrap">Upload →</span>
        </Link>
      )}

      {jobs.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50/50 px-6 py-16 text-center">
          <p className="text-slate-500">No open positions right now. Check back soon.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {jobs.map((job) => {
            const interviewed = doneSet.has(job.id)
            const href = interviewed || hasResume ? `/interview/${job.slug}` : '/dashboard/profile?tab=resume'
            return (
              <Link
                key={job.id}
                href={href}
                className="group flex flex-col h-full min-h-[190px] bg-white border border-slate-200 rounded-2xl p-6 hover:border-indigo-400 hover:shadow-[0_10px_30px_-12px_rgba(79,70,229,0.25)] transition-all"
              >
                <h3 className="text-lg font-bold text-slate-900 leading-snug group-hover:text-indigo-600 transition-colors line-clamp-2">
                  {job.title}
                </h3>
                <p className="text-sm text-slate-500 mt-2">{job.role || 'Remote role'}</p>

                {interviewed && (
                  <span className="inline-flex w-fit mt-3 text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                    ✓ Interviewed
                  </span>
                )}

                <div className="mt-auto pt-5 flex items-center justify-between">
                  <span className="inline-flex items-center gap-1.5 text-[11px] font-black uppercase tracking-widest text-indigo-600">
                    <span className="text-indigo-500">✦</span> AI Interview
                  </span>
                  <span className="text-slate-400 group-hover:text-indigo-500 transition-colors">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M14 5l7 7m0 0l-7 7m7-7H3" />
                    </svg>
                  </span>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
