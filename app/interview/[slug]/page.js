import { redirect } from 'next/navigation'
import { getSupabaseServer } from '@/lib/supabase/server'
import { query } from '@/lib/db'
import ApplicationHub from '@/components/ApplicationHub'

export const dynamic = 'force-dynamic'

const ROLE_LABELS = {
  'swe-backend': 'Backend Engineering',
  'pm-consumer': 'Product Management',
  'sales-ae': 'Sales (AE)',
}

async function fetchJob(slug) {
  const { rows } = await query(
    `SELECT id, slug, title, role, description, company,
            required_assessments, requires_ai_interview
     FROM interview_jobs WHERE slug = $1 AND is_active = true`,
    [slug]
  )
  return rows[0] || null
}

export default async function ApplicationHubPage({ params }) {
  const job = await fetchJob(params.slug)
  if (!job) {
    return (
      <div className="min-h-screen pt-32 pb-24 px-4">
        <div className="container mx-auto max-w-2xl text-center">
          <h1 className="text-3xl font-black uppercase text-slate-900 mb-4">Position not found</h1>
          <p className="text-slate-500">The link may be invalid or the role may have closed.</p>
        </div>
      </div>
    )
  }

  const supabase = getSupabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect(`/login?next=${encodeURIComponent(`/interview/${params.slug}`)}`)

  const slug = params.slug

  // Pull everything needed to compute step status in parallel.
  const [profRes, expertRes, assessRes, ivRes, appRes] = await Promise.all([
    query(`SELECT full_name, (resume_text IS NOT NULL) AS has_resume, resume_uploaded_at FROM user_profiles WHERE user_id = $1`, [user.id]).catch(() => null),
    query(`SELECT domain, created_at FROM expert_assessments WHERE candidate_user_id = $1 ORDER BY created_at DESC LIMIT 1`, [user.id]).catch(() => null),
    query(`SELECT role_family, MAX(completed_at) AS done_at FROM assessment_sessions
           WHERE job_id = $1 AND candidate_user_id = $2 AND state IN ('submitted','completed') GROUP BY role_family`, [job.id, user.id]).catch(() => null),
    query(`SELECT created_at FROM interview_candidates WHERE job_id = $1 AND user_id = $2 ORDER BY created_at DESC LIMIT 1`, [job.id, user.id]).catch(() => null),
    query(`SELECT status, submitted_at FROM job_applications WHERE job_id = $1 AND candidate_user_id = $2`, [job.id, user.id]).catch(() => null),
  ])

  const profile = profRes?.rows?.[0] || {}
  const hasResume = !!profile.has_resume
  const expert = expertRes?.rows?.[0] || null
  const assessDone = new Map((assessRes?.rows || []).map((r) => [r.role_family, r.done_at]))
  const interview = ivRes?.rows?.[0] || null
  const application = appRes?.rows?.[0] || null

  const fmt = (d) => d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : null

  // ── Build the ordered step checklist (Mercor-style) ────────────────────────
  const steps = []

  // 1. Resume — account-level, reused across every application
  steps.push({
    key: 'resume', label: 'Resume', kind: 'resume', reused: true,
    done: hasResume,
    statusDone: hasResume ? `Uploaded ${fmt(profile.resume_uploaded_at) || 'to your profile'}` : null,
    statusTodo: 'Upload your resume PDF',
    href: '/dashboard/profile?tab=resume',
  })

  // 2. Expert Interview — account-level CORE step, reused
  steps.push({
    key: 'expert', label: 'Domain Expert Interview', kind: 'expert', core: true, reused: true,
    done: !!expert,
    statusDone: expert ? `Completed ${fmt(expert.created_at)}` : null,
    statusTodo: 'A 30-minute voice interview with Maya',
    href: '/dashboard/domain-expert',
  })

  // 3. Skills assessments — per job
  for (const code of (job.required_assessments || [])) {
    const doneAt = assessDone.get(code)
    steps.push({
      key: `assess-${code}`, label: `Skills Assessment · ${ROLE_LABELS[code] || code}`, kind: 'assessment',
      done: !!doneAt,
      statusDone: doneAt ? `Completed ${fmt(doneAt)}` : null,
      statusTodo: 'Adaptive scenario, coding & MCQ questions',
      href: `/assessment?jobId=${job.id}&role=${code}&slug=${slug}`,
    })
  }

  // 4. AI job interview — per job
  if (job.requires_ai_interview) {
    steps.push({
      key: 'interview', label: 'AI Job Interview · Iris', kind: 'interview',
      done: !!interview,
      statusDone: interview ? `Completed ${fmt(interview.created_at)}` : null,
      statusTodo: 'A conversational interview about this role',
      href: `/interview/${slug}/session`,
    })
  }

  const doneCount = steps.filter((s) => s.done).length
  const allComplete = doneCount === steps.length

  return (
    <ApplicationHub
      job={{ id: job.id, slug: job.slug, title: job.title, role: job.role, company: job.company, description: job.description }}
      steps={steps}
      doneCount={doneCount}
      allComplete={allComplete}
      application={application}
    />
  )
}
