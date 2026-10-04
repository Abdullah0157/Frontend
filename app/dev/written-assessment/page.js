// DEV-ONLY test route (same pattern as app/dev/assessment-test): mounts the
// written assessment without a login so it can be tried locally. Returns 404
// in production builds.
import { notFound } from 'next/navigation'
import WrittenAssessment from '@/components/WrittenAssessment'

export default function DevWrittenAssessment() {
  if (process.env.NODE_ENV === 'production') notFound()
  return <div className="pt-10"><WrittenAssessment track="backend" level="L3" /></div>
}
