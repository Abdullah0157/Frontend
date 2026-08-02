import { NextResponse } from 'next/server'
import { getSupabaseServer } from '@/lib/supabase/server'
import { callGemini, textFrom, stripJsonFences } from '@/lib/gemini'
import { query } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function POST(req) {
  const supabase = getSupabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  // Get resume text from DB
  const { rows } = await query(
    'SELECT resume_text FROM user_profiles WHERE user_id = $1',
    [user.id]
  )
  const resumeText = rows[0]?.resume_text
  if (!resumeText) return NextResponse.json({ error: 'No resume uploaded' }, { status: 400 })

  const prompt = `You are a precise resume parser. Extract EVERY piece of structured information from the resume below and return ONLY valid JSON (no markdown, no code fences, no commentary before or after).

EXACT structure to return:
{
  "summary": "one-paragraph professional summary (use the resume's own summary/objective if present, otherwise synthesize 1-2 sentences from the content)",
  "experience": [
    { "id": "exp_1", "title": "Job Title", "company": "Company Name", "city": "City", "country": "Country", "startYear": "2020", "endYear": "Present", "dates": "Jan 2020 – Present", "bullets": ["achievement/responsibility 1", "achievement 2"] }
  ],
  "education": [
    { "id": "edu_1", "degree": "Degree Name", "school": "School Name", "major": "Field of study", "gpa": "3.8", "startYear": "2021", "endYear": "2025" }
  ],
  "projects": [
    { "id": "proj_1", "name": "Project Name", "tech": "React, Node.js", "startYear": "", "endYear": "", "description": "what it does and your role" }
  ],
  "skills": ["Skill1", "Skill2", "Skill3"],
  "publications": [
    { "id": "pub_1", "title": "Publication title", "description": "venue / brief note" }
  ],
  "certifications": [
    { "id": "cert_1", "name": "Certification name", "issuer": "Issuer", "year": "2024" }
  ],
  "awards": [
    { "id": "awd_1", "title": "Award name", "year": "2024" }
  ],
  "languages": ["English", "Urdu"],
  "coding_profiles": [
    { "id": "cp_1", "platform": "LeetCode", "username": "handle", "url": "https://leetcode.com/handle" }
  ],
  "links": [
    { "id": "ln_1", "label": "Portfolio", "url": "https://example.com" }
  ]
}

STRICT RULES:
- Extract ONLY facts that actually appear in the resume — never invent companies, dates, degrees, or skills.
- Include EVERY job in "experience", EVERY school in "education", and EVERY project in "projects" — do not skip or merge entries.
- Preserve each job's real bullet points (lightly condensed if very long, max ~20 words each). Keep all of them, don't drop bullets.
- Give each item a unique sequential id (exp_1, exp_2, edu_1, proj_1, cp_1, ln_1, ...).
- "coding_profiles": competitive/coding platforms with a profile URL or handle — LeetCode, HackerRank, Codeforces, CodeChef, GitHub, Kaggle, etc. Include the URL if present.
- "links": any other personal URLs — portfolio, personal website, blog, LinkedIn, Behance, Dribbble. Give each a short human label.
- If a section genuinely has no data, use an empty array []. summary "" only if truly nothing to summarize.
- "skills": individual technologies/tools/competencies actually mentioned, de-duplicated, max 30.
- Dates exactly as written in the resume.
- Output must be a single valid JSON object and NOTHING else.

RESUME:
${resumeText.slice(0, 14000)}`

  // Try up to 2 times — a truncated/garbled first response is retried once.
  // maxOutputTokens is generous so rich resumes don't get cut mid-JSON.
  async function attemptParse() {
    const result = await callGemini({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.1, maxOutputTokens: 4096, thinkingConfig: { thinkingBudget: 0 } },
    })
    if (!result.ok) {
      const msg = result.data?.error?.message || 'AI unavailable'
      const err = new Error(msg); err.status = result.status || 502; err.aiFail = true
      throw err
    }
    const raw = textFrom(result.data) || ''
    const cleaned = stripJsonFences(raw)
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error('No JSON in AI response')
    return JSON.parse(jsonMatch[0])
  }

  let sections = null
  let lastErr = null
  for (let i = 0; i < 2; i++) {
    try {
      sections = await attemptParse()
      break
    } catch (e) {
      lastErr = e
      if (e.aiFail && e.status && e.status !== 429 && e.status < 500) break // hard AI error, don't retry
    }
  }

  if (!sections) {
    return NextResponse.json(
      { error: lastErr?.message || 'Could not parse resume. Please try again.' },
      { status: lastErr?.status || 500 }
    )
  }

  // Normalize shape so the UI never crashes on missing keys.
  const normalized = {
    summary: typeof sections.summary === 'string' ? sections.summary : '',
    experience: Array.isArray(sections.experience) ? sections.experience : [],
    education: Array.isArray(sections.education) ? sections.education : [],
    projects: Array.isArray(sections.projects) ? sections.projects : [],
    skills: Array.isArray(sections.skills) ? sections.skills : [],
    publications: Array.isArray(sections.publications) ? sections.publications : [],
    certifications: Array.isArray(sections.certifications) ? sections.certifications : [],
    awards: Array.isArray(sections.awards) ? sections.awards : [],
    languages: Array.isArray(sections.languages) ? sections.languages : [],
    coding_profiles: Array.isArray(sections.coding_profiles) ? sections.coding_profiles : [],
    links: Array.isArray(sections.links) ? sections.links : [],
  }

  try {
    await query(
      `UPDATE user_profiles SET resume_sections = $1, updated_at = now() WHERE user_id = $2`,
      [JSON.stringify(normalized), user.id]
    )
  } catch (e) {
    console.warn('parse-resume: DB save failed:', e.message)
  }

  return NextResponse.json({ sections: normalized })
}
