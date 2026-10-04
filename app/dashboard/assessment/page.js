import WrittenAssessment from '@/components/WrittenAssessment'
import { query } from '@/lib/db'
import { trackFromRoleFamily, LEVELS } from '@/lib/assessment-blueprint'

export const metadata = { title: 'Skills Assessment — JobStream' }
export const dynamic = 'force-dynamic'

// /dashboard/assessment?jobId=<uuid>&slug=<jobSlug>   a job's written test:
//   the job decides track, level and allowed languages (the server enforces
//   them too), and the finish screen links back to the application.
// /dashboard/assessment?role=swe-backend&level=L3      standalone practice.
export default async function AssessmentPage({ searchParams }) {
  const jobId = /^[0-9a-f-]{36}$/i.test(searchParams?.jobId || '') ? searchParams.jobId : null
  const jobSlug = searchParams?.slug || null
  let track = trackFromRoleFamily(searchParams?.role || 'swe-backend') || 'backend'
  let level = LEVELS[searchParams?.level] ? searchParams.level : null
  let languages = null
  if (jobId) {
    const { rows } = await query(`SELECT assessment_config FROM interview_jobs WHERE id = $1`, [jobId]).catch(() => ({ rows: [] }))
    const cfg = rows[0]?.assessment_config
    if (cfg) {
      track = cfg.track
      level = cfg.level
      languages = cfg.languages
    } else {
      level = level || 'L3'
    }
  }
  return (
    <WrittenAssessment
      track={track}
      level={level}
      jobId={jobId}
      allowedLanguages={languages}
      returnTo={jobSlug ? `/interview/${jobSlug}` : null}
    />
  )
}
