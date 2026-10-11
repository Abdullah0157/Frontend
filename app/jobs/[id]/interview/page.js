import { notFound, redirect } from 'next/navigation'
import { query } from '@/lib/db'

export const dynamic = 'force-dynamic'

// Old interview links (/jobs/<id>/interview). The interview for a job now
// starts at /interview/<slug>; external jobs from the old hosted backend were
// retired, along with the route that turned them into interview jobs.
export default async function JobInterviewLink({ params }) {
  if (/^[0-9a-f-]{36}$/i.test(String(params.id))) {
    const { rows } = await query(
      `SELECT slug FROM interview_jobs WHERE id = $1 AND is_active IS NOT FALSE`,
      [params.id]
    ).catch(() => ({ rows: [] }))
    if (rows[0]) redirect(`/interview/${rows[0].slug}`)
  }
  notFound()
}
