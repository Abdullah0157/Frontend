// DEV-ONLY test route (same pattern as app/dev/assessment-test): mounts the
// written assessment without a login so it can be tried locally. Returns 404
// in production builds.
import { notFound } from 'next/navigation'
import WrittenAssessment from '@/components/WrittenAssessment'

// ?track=general&level=staff, ?track=customer_service&level=agent&profile=chat
export default function DevWrittenAssessment({ searchParams }) {
  if (process.env.NODE_ENV === 'production') notFound()
  const track = searchParams?.track || 'backend'
  const level = searchParams?.level || 'L3'
  const options = searchParams?.profile ? { typingProfile: searchParams.profile } : {}
  return <div className="pt-10"><WrittenAssessment track={track} level={level} options={options} /></div>
}
