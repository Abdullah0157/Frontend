// DEV-ONLY preview of the company report (same pattern as app/dev/assessment-test).
// Reads the report on the server for a local session id. 404 in production.
import { notFound } from 'next/navigation'
import WrittenReportView from '@/components/WrittenReportView'
import { companyReport } from '@/lib/written-assessment'

export const dynamic = 'force-dynamic'

export default async function DevWrittenReport({ params }) {
  if (process.env.NODE_ENV === 'production') notFound()
  const data = await companyReport(params.sessionId).catch(() => null)
  if (!data) notFound()
  return <div className="pt-10"><WrittenReportView data={JSON.parse(JSON.stringify(data))} /></div>
}
