import WrittenAssessment from '@/components/WrittenAssessment'
import { trackFromRoleFamily, LEVELS } from '@/lib/assessment-blueprint'

export const metadata = { title: 'Skills Assessment — JobStream' }

// Supports job-scoped assessments via query params:
//   /dashboard/assessment?jobId=<uuid>&role=<roleFamily>&level=<L2..L5>&slug=<jobSlug>
// When jobId is present the completed session is tied to that job application
// and the finish screen offers "Back to application". Without a level the
// candidate chooses one (standalone practice).
export default function AssessmentPage({ searchParams }) {
  const jobId = searchParams?.jobId || null
  const track = trackFromRoleFamily(searchParams?.role || 'swe-backend') || 'backend'
  const level = LEVELS[searchParams?.level] ? searchParams.level : null
  const jobSlug = searchParams?.slug || null
  return (
    <WrittenAssessment
      track={track}
      level={level}
      jobId={jobId}
      returnTo={jobSlug ? `/interview/${jobSlug}` : null}
    />
  )
}
