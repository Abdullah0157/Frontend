import { NextResponse } from 'next/server'
import { getSupabaseServer } from '@/lib/supabase/server'
import { query } from '@/lib/db'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// In-memory cache for the unranked job list — avoids a full DB round-trip on
// every page visit. Invalidated after 30 s so fresh jobs still appear quickly.
let jobCache = null
let jobCacheAt = 0
const CACHE_TTL_MS = 30_000

// Public job listing — combines:
//  - 'external' jobs aggregated from the HF backend (micro1 etc.) — apply via referral link
//  - 'ai_interview' jobs posted by companies through /company/jobs — apply by taking an AI interview
//
// Each result has a `type` field so the UI knows which apply path to render.
// If the user is logged in as a candidate, the response also ranks results by
// resume keyword overlap (re-uses the same scoring logic as /api/jobs/matched).
const STOPWORDS = new Set([
  'the','and','for','with','from','that','this','have','has','had','was','were',
  'will','our','your','their','its','about','into','than','then','they','them',
  'these','those','also','any','all','more','most','some','such','only','very',
  'i','a','an','of','to','in','is','it','as','on','by','be','at','or','if','my',
  'me','we','us','you','he','she','his','her','him','do','did','does','can',
  'could','should','would','may','might','just','here','there','using',
  'used','use','etc','via','per','year','years','months','team','teams','work',
  'working','worked','project','projects','experience','company','companies',
])

function tokenize(text) {
  if (!text) return []
  return String(text).toLowerCase().replace(/[^a-z0-9+#./\s-]/g, ' ').split(/\s+/)
    .filter((t) => t.length >= 2 && !STOPWORDS.has(t))
}

function scoreJob(blob, keywordsSet) {
  const tokens = new Set(tokenize(blob))
  let hits = 0
  for (const k of keywordsSet) if (tokens.has(k)) hits++
  return hits
}

export async function GET(req) {
  try {
    const url = new URL(req.url)
    const filter = url.searchParams.get('filter') || 'all' // all | ai | external

    const now = Date.now()
    const cacheValid = jobCache && (now - jobCacheAt) < CACHE_TTL_MS

    let external, aiJobs

    if (cacheValid && filter === 'all') {
      // Serve from cache — skip the DB round-trip entirely.
      ;({ external, aiJobs } = jobCache)
    } else {
      // External scraped jobs have been retired — the board now shows ONLY
      // jobs that companies/admin create (with the assessment + AI interview
      // application flow). Kept as an empty source so the rest of the shape
      // (totals, filters) still works.
      const externalPromise = Promise.resolve([])

      const aiPromise = filter === 'external'
        ? Promise.resolve([])
        : query(
            `SELECT j.id, j.slug, j.title, j.role, j.description,
                    COALESCE(cp.company_name, j.company) AS company,
                    cp.logo_url AS logo,
                    j.created_at
             FROM interview_jobs j
             LEFT JOIN company_profiles cp ON cp.user_id = j.owner_id
             ORDER BY j.created_at DESC`
          ).then(({ rows }) => rows.map((r) => ({
            id: r.id,
            slug: r.slug,
            title: r.title,
            role: r.role,
            company: r.company || 'Direct Hire',
            location: 'Remote',
            type: 'ai_interview',
            salary: 'Apply via AI Interview',
            posted_at: r.created_at,
            logo: r.logo || '',
            tags: [],
            description: (r.description || '').slice(0, 300),
            apply_url: '',
            link: `/interview/${r.slug}`,
            is_new: true,
            is_high_demand: false,
          }))).catch((e) => { console.warn('ai jobs query failed', e.message); return [] })

      ;[external, aiJobs] = await Promise.all([externalPromise, aiPromise])

      // Only cache unfiltered results — filtered variants are rare.
      if (filter === 'all') {
        jobCache = { external, aiJobs }
        jobCacheAt = now
      }
    }

    let jobs = [...aiJobs, ...external]

    // 3) Optional keyword ranking for logged-in candidates
    let ranked = false
    try {
      const supabase = getSupabaseServer()
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { rows: profRows } = await query(
          `SELECT account_type, resume_text FROM user_profiles WHERE user_id = $1`,
          [user.id]
        )
        if (profRows[0]?.account_type === 'candidate' && profRows[0]?.resume_text) {
          const tokens = tokenize(profRows[0].resume_text)
          const counts = new Map()
          for (const t of tokens) counts.set(t, (counts.get(t) || 0) + 1)
          const keywords = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 80).map(([t]) => t)
          const set = new Set(keywords)
          jobs = jobs.map((j) => {
            const blob = `${j.title} ${(j.tags || []).join(' ')} ${(j.description || '').slice(0, 600)}`
            const hits = scoreJob(blob, set)
            const matchPct = keywords.length === 0 ? 0 : Math.min(100, Math.round((hits / keywords.length) * 100 * 2))
            // Boost AI interview jobs slightly so they're not buried.
            const bonus = j.type === 'ai_interview' ? 5 : 0
            return { ...j, match_score: hits + bonus, match_pct: matchPct }
          }).sort((a, b) => (b.match_score || 0) - (a.match_score || 0))
          ranked = true
        }
      }
    } catch (e) {
      console.warn('ranking pass failed', e.message)
    }

    const headers = ranked
      ? { 'Cache-Control': 'private, no-store' }
      : { 'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60' }

    return NextResponse.json(
      { jobs, ranked, totals: { ai: aiJobs.length, external: external.length } },
      { headers }
    )
  } catch (e) {
    console.error('public-listing error', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
