import { NextResponse } from 'next/server'
import { getSupabaseServer } from '@/lib/supabase/server'
import { query } from '@/lib/db'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// Tokens we ignore when extracting "skills" from a resume.
const STOPWORDS = new Set([
  'the','and','for','with','from','that','this','have','has','had','was','were',
  'will','our','your','their','its','about','into','than','then','they','them',
  'these','those','also','any','all','more','most','some','such','only','very',
  'i','a','an','of','to','in','is','it','as','on','by','be','at','or','if','my',
  'me','we','us','you','he','she','his','her','him','do','did','does','can',
  'could','should','would','may','might','just','here','there','also','using',
  'used','use','etc','via','per','year','years','months','team','teams','work',
  'working','worked','project','projects','experience','company','companies',
  'role','roles','responsible','responsibilities','include','includes','included',
])

function tokenize(text) {
  if (!text) return []
  return String(text)
    .toLowerCase()
    .replace(/[^a-z0-9+#./\s-]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length >= 2 && !STOPWORDS.has(t))
}

function extractResumeKeywords(resumeText, max = 80) {
  const counts = new Map()
  for (const tok of tokenize(resumeText)) {
    counts.set(tok, (counts.get(tok) || 0) + 1)
  }
  // Most frequent meaningful tokens first
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, max)
    .map(([t]) => t)
}

function scoreJob(job, keywordsSet) {
  const title = (job.title || '').toLowerCase()
  const tags = Array.isArray(job.tags) ? job.tags.join(' ').toLowerCase() : ''
  const desc = (job.description || '').slice(0, 600).toLowerCase()
  const blob = `${title} ${tags} ${desc}`
  const blobTokens = new Set(tokenize(blob))
  let hits = 0
  // Tag matches weigh more, title even more
  let weighted = 0
  for (const k of keywordsSet) {
    if (blobTokens.has(k)) {
      hits++
      weighted += 1
      if (title.includes(k)) weighted += 2
      if (tags.includes(k)) weighted += 1
    }
  }
  return { hits, weighted }
}

export async function GET(req) {
  try {
    const supabase = getSupabaseServer()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

    const { rows } = await query(
      `SELECT resume_text FROM user_profiles WHERE user_id = $1`,
      [user.id]
    )
    const resumeText = rows[0]?.resume_text

    // Fetch base jobs from HF backend
    const apiUrl = process.env.NEXT_PUBLIC_API_URL
    const url = new URL(req.url)
    const limit = Number(url.searchParams.get('limit') || '500')
    const res = await fetch(`${apiUrl}/jobs?limit=${limit}`, { cache: 'no-store' })
    if (!res.ok) {
      return NextResponse.json({ error: 'Backend fetch failed', status: res.status }, { status: 502 })
    }
    let jobs = await res.json()
    if (!Array.isArray(jobs)) jobs = jobs?.jobs || jobs?.data || []

    if (!resumeText) {
      // No resume: return jobs as-is, no scores
      return NextResponse.json({ jobs, ranked: false })
    }

    const keywords = extractResumeKeywords(resumeText)
    const keywordsSet = new Set(keywords)

    const ranked = jobs
      .map((j) => {
        const { hits, weighted } = scoreJob(j, keywordsSet)
        const matchPct = keywords.length === 0 ? 0 : Math.min(100, Math.round((hits / keywords.length) * 100 * 2))
        return { ...j, match_score: weighted, match_hits: hits, match_pct: matchPct }
      })
      .sort((a, b) => b.match_score - a.match_score)

    return NextResponse.json({ jobs: ranked, ranked: true, keywords_used: keywords.length })
  } catch (e) {
    console.error('matched route error:', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
