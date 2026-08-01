import AssessmentExperience from './AssessmentExperience'

export const metadata = { title: 'Skills Assessment — JobStream' }

// Supports job-scoped assessments via query params:
//   /assessment?jobId=<uuid>&role=<roleFamily>&slug=<jobSlug>
// When jobId is present, the completed session is tied to that job application
// and the results screen offers a "Back to application" link.
export default function AssessmentPage({ searchParams }) {
  const jobId = searchParams?.jobId || null
  const roleFamily = searchParams?.role || 'swe-backend'
  const jobSlug = searchParams?.slug || null
  return (
    <AssessmentExperience
      roleFamily={roleFamily}
      jobId={jobId}
      returnTo={jobSlug ? `/interview/${jobSlug}` : null}
    />
  )
}
