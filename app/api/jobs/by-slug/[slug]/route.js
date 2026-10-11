import { NextResponse } from 'next/server'
import { query } from '@/lib/db'

export const runtime = 'nodejs'

// Public job details. Cached at the CDN for a minute (stale copies served
// while it refreshes): under load every view was a database round trip, and
// the database refused connections from about 50 views a second.
const CACHE = { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' }

export async function GET(_req, { params }) {
  try {
    const { slug } = params
    const { rows } = await query(
      `SELECT id, slug, title, role, description, company,
              required_assessments, requires_ai_interview, is_active
       FROM interview_jobs WHERE slug = $1`,
      [slug]
    )
    if (rows.length === 0) return NextResponse.json({ error: 'Job not found' }, { status: 404, headers: CACHE })
    return NextResponse.json({ job: rows[0] }, { headers: CACHE })
  } catch (e) {
    console.error('jobs/by-slug error:', e)
    return NextResponse.json({ error: 'Could not load this job.' }, { status: 500 })
  }
}
