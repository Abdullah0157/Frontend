import { notFound, redirect } from 'next/navigation'
import { query } from '@/lib/db'

export const dynamic = 'force-dynamic'

// Old job links (/jobs/<id>). Jobs now open at /interview/<slug>; the external
// jobs this page used to load from the old hosted backend were retired.
export default async function JobLink({ params }) {
  if (/^[0-9a-f-]{36}$/i.test(String(params.id))) {
    const { rows } = await query(
      `SELECT slug FROM interview_jobs WHERE id = $1 AND is_active IS NOT FALSE`,
      [params.id]
    ).catch(() => ({ rows: [] }))
    if (rows[0]) redirect(`/interview/${rows[0].slug}`)
  }
  notFound()
}
