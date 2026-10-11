// Open jobs for the public board, and ranking them against a resume by keyword
// overlap. One copy, shared by the job list, resume matching and the chatbot.

import { query } from './db.js'

const STOPWORDS = new Set([
  'the', 'and', 'for', 'with', 'from', 'that', 'this', 'have', 'has', 'had', 'was', 'were',
  'will', 'our', 'your', 'their', 'its', 'about', 'into', 'than', 'then', 'they', 'them',
  'these', 'those', 'also', 'any', 'all', 'more', 'most', 'some', 'such', 'only', 'very',
  'i', 'a', 'an', 'of', 'to', 'in', 'is', 'it', 'as', 'on', 'by', 'be', 'at', 'or', 'if', 'my',
  'me', 'we', 'us', 'you', 'he', 'she', 'his', 'her', 'him', 'do', 'did', 'does', 'can',
  'could', 'should', 'would', 'may', 'might', 'just', 'here', 'there', 'using',
  'used', 'use', 'etc', 'via', 'per', 'year', 'years', 'months', 'team', 'teams', 'work',
  'working', 'worked', 'project', 'projects', 'experience', 'company', 'companies',
  'role', 'roles', 'responsible', 'responsibilities', 'include', 'includes', 'included',
])

export function tokenize(text) {
  if (!text) return []
  return String(text).toLowerCase().replace(/[^a-z0-9+#./\s-]/g, ' ').split(/\s+/)
    .filter((t) => t.length >= 2 && !STOPWORDS.has(t))
}

// The resume's most frequent meaningful words.
export function resumeKeywords(resumeText, max = 80) {
  const counts = new Map()
  for (const t of tokenize(resumeText)) counts.set(t, (counts.get(t) || 0) + 1)
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, max).map(([t]) => t)
}

// Adds match_score and match_pct to each job and sorts best first. A word in
// the title counts more than one in the description.
export function rankJobs(jobs, resumeText) {
  const keywords = resumeKeywords(resumeText)
  if (keywords.length === 0) return jobs.map((j) => ({ ...j, match_score: 0, match_pct: 0 }))
  return jobs.map((j) => {
    const title = new Set(tokenize(j.title))
    const blob = new Set(tokenize(`${j.title} ${j.role || ''} ${(j.tags || []).join(' ')} ${(j.description || '').slice(0, 600)}`))
    let hits = 0
    let weighted = 0
    for (const k of keywords) {
      if (!blob.has(k)) continue
      hits++
      weighted += title.has(k) ? 3 : 1
    }
    return { ...j, match_score: weighted, match_pct: Math.min(100, Math.round((hits / keywords.length) * 200)) }
  }).sort((a, b) => b.match_score - a.match_score)
}

// Open jobs in the shape the job cards use. Closed jobs (is_active false)
// are left out: their interview page refuses them anyway.
export async function listOpenJobs() {
  const { rows } = await query(
    `SELECT j.id, j.slug, j.title, j.role, j.description,
            COALESCE(NULLIF(j.company, ''), cp.company_name) AS company,
            cp.logo_url AS logo,
            j.created_at
     FROM interview_jobs j
     LEFT JOIN company_profiles cp ON cp.user_id = j.owner_id
     WHERE j.is_active IS NOT FALSE
     ORDER BY j.created_at DESC`
  )
  return rows.map((r) => ({
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
  }))
}
