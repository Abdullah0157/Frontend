import { redirect } from 'next/navigation'

// The assessment now lives inside the dashboard. Redirect any old /assessment
// links (preserving query params) to /dashboard/assessment.
export default function LegacyAssessmentRedirect({ searchParams }) {
  const qs = new URLSearchParams(searchParams || {}).toString()
  redirect(`/dashboard/assessment${qs ? `?${qs}` : ''}`)
}
