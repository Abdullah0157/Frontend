import { NextResponse } from 'next/server'
import { getSupabaseServer } from '@/lib/supabase/server'
import { query } from '@/lib/db'
import { listOpenJobs, rankJobs } from '@/lib/job-match'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// In-memory cache for the unranked job list — avoids a full DB round-trip on
// every page visit. Invalidated after 30 s so fresh jobs still appear quickly.
let jobCache = null
let jobCacheAt = 0
const CACHE_TTL_MS = 30_000

// Public job listing: the open jobs companies post through /company/jobs
// (apply by taking the assessment + AI interview). External scraped jobs were
// retired; `totals.external` stays 0 so the response shape is unchanged.
// A logged-in candidate with a resume gets the list ranked by keyword overlap.
export async function GET(req) {
  try {
    const filter = new URL(req.url).searchParams.get('filter') || 'all' // all | ai | external
    let aiJobs
    if (filter === 'external') {
      aiJobs = []
    } else if (jobCache && Date.now() - jobCacheAt < CACHE_TTL_MS) {
      aiJobs = jobCache
    } else {
      aiJobs = await listOpenJobs().catch((e) => { console.warn('ai jobs query failed', e.message); return [] })
      jobCache = aiJobs
      jobCacheAt = Date.now()
    }

    let jobs = aiJobs
    let ranked = false
    try {
      const { data: { user } } = await getSupabaseServer().auth.getUser()
      if (user) {
        const { rows } = await query(`SELECT account_type, resume_text FROM user_profiles WHERE user_id = $1`, [user.id])
        if (rows[0]?.account_type === 'candidate' && rows[0]?.resume_text) {
          jobs = rankJobs(jobs, rows[0].resume_text)
          ranked = true
        }
      }
    } catch (e) {
      console.warn('ranking pass failed', e.message)
    }

    const headers = ranked
      ? { 'Cache-Control': 'private, no-store' }
      : { 'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60' }
    return NextResponse.json({ jobs, ranked, totals: { ai: aiJobs.length, external: 0 } }, { headers })
  } catch (e) {
    console.error('public-listing error', e)
    return NextResponse.json({ error: 'Could not load jobs.' }, { status: 500 })
  }
}
