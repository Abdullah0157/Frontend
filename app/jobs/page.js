import JobsClient from '@/components/JobsClient'
import { formatPay } from '@/lib/pay'
import { query } from '@/lib/db'

export const metadata = {
  title: 'Find Jobs | JobStream AI',
  description: 'Browse the latest remote and full-time tech jobs matched by AI.',
}

// Revalidate the page every 60 s so the pre-rendered HTML stays fresh.
export const revalidate = 60

// Company/admin-created jobs only (the external scrape has been retired).
// Each links into the application hub at /interview/[slug].
async function getJobs() {
  try {
    const base = `SELECT j.id, j.slug, j.title, j.role, j.description,
              COALESCE(cp.company_name, j.company) AS company,
              cp.logo_url AS logo, j.created_at%COLS%
       FROM interview_jobs j
       LEFT JOIN company_profiles cp ON cp.user_id = j.owner_id
       WHERE j.is_active
       ORDER BY j.created_at DESC
       LIMIT 100`
    // The pay columns are added by the marketplace seeder; fall back to the
    // pre-migration column set so a database without them still renders.
    let rows
    try {
      ({ rows } = await query(base.replace('%COLS%', ', j.pay_type, j.pay_min, j.pay_max')))
    } catch {
      ({ rows } = await query(base.replace('%COLS%', '')))
    }
    return rows.map((r) => ({
      id: r.id,
      slug: r.slug,
      title: r.title,
      role: r.role,
      company: r.company || 'Direct Hire',
      location: 'Remote',
      type: 'ai_interview',
      // Show the real rate when we have one; only fall back to the generic
      // line for legacy jobs posted before pay was captured.
      salary: formatPay(r) || 'Apply via AI Interview',
      posted_at: r.created_at,
      logo: r.logo || '',
      tags: [],
      description: (r.description || '').slice(0, 300),
      apply_url: '',
      link: `/interview/${r.slug}`,
      is_new: true,
      is_high_demand: false,
    }))
  } catch (error) {
    console.error('Error fetching jobs server-side:', error)
    return []
  }
}

export default async function JobsPage() {
  const jobs = await getJobs()

  return (
    <JobsClient initialJobs={jobs} />
  )
}
