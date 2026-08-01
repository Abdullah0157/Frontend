import { NextResponse } from 'next/server'
import { getSupabaseServer } from '@/lib/supabase/server'
import { callGemini, textFrom, stripJsonFences } from '@/lib/gemini'
import { query } from '@/lib/db'

export const dynamic = 'force-dynamic'

// Build a clean, structured resume text from the user-verified parsed sections.
// This is what Maya reads, so edits the candidate made in their profile are
// reflected. Appends the raw text as backup context so nothing is lost.
function formatSections(s, rawText) {
  const lines = []
  if (s.summary) lines.push(`SUMMARY:\n${s.summary}\n`)
  if (Array.isArray(s.skills) && s.skills.length) lines.push(`SKILLS: ${s.skills.join(', ')}\n`)
  if (Array.isArray(s.experience) && s.experience.length) {
    lines.push('EXPERIENCE:')
    for (const e of s.experience) {
      const head = [e.title, e.company, e.location, e.dates].filter(Boolean).join(' · ')
      lines.push(`- ${head}`)
      for (const b of (e.bullets || [])) lines.push(`    • ${b}`)
    }
    lines.push('')
  }
  if (Array.isArray(s.education) && s.education.length) {
    lines.push('EDUCATION:')
    for (const ed of s.education) lines.push(`- ${[ed.degree, ed.school, ed.year].filter(Boolean).join(' · ')}`)
    lines.push('')
  }
  if (Array.isArray(s.projects) && s.projects.length) {
    lines.push('PROJECTS:')
    for (const p of s.projects) lines.push(`- ${p.name}${p.tech ? ` (${p.tech})` : ''}${p.description ? `: ${p.description}` : ''}`)
    lines.push('')
  }
  const structured = lines.join('\n').trim()
  // If the structured version is thin, fall back to raw text entirely.
  if (structured.length < 100) return rawText
  return structured
}

// POST /api/interview/detect-domain
// Reads the logged-in user's resume from user_profiles and asks the AI to
// determine their primary professional domain + the specific focus areas Maya
// should probe. Used to auto-configure the Domain Expert interview so the user
// never types their domain manually.
export async function POST() {
  let rows
  try {
    const supabase = getSupabaseServer()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

    ;({ rows } = await query(
      'SELECT full_name, resume_text, resume_sections FROM user_profiles WHERE user_id = $1',
      [user.id]
    ))
  } catch (e) {
    // Auth service or database briefly unreachable (transient network).
    console.error('detect-domain connectivity error:', e.message)
    return NextResponse.json(
      { error: 'Connection issue reaching the server. Please try again in a moment.' },
      { status: 503 }
    )
  }
  const rawText = rows[0]?.resume_text
  const fullName = rows[0]?.full_name || ''
  const sections = rows[0]?.resume_sections
    ? (typeof rows[0].resume_sections === 'string' ? JSON.parse(rows[0].resume_sections) : rows[0].resume_sections)
    : null
  if (!rawText || rawText.trim().length < 50) {
    return NextResponse.json({ error: 'No resume on file. Please upload your resume first.' }, { status: 400 })
  }

  // Prefer the parsed, USER-VERIFIED sections (they reflect any edits the
  // candidate made). Fall back to raw PDF text if not parsed yet. This is what
  // Maya reads, so corrections in the profile actually reach the interview.
  const resumeText = sections ? formatSections(sections, rawText) : rawText

  const prompt = `Analyze this resume and identify the person's professional domain for an expertise-validation interview.

Output STRICT JSON only — no markdown, no code fences:
{
  "domain": "<their primary domain of expertise, specific — e.g. 'Backend Engineering (distributed systems)', 'Growth Marketing', 'Clinical Research'>",
  "seniority": "junior" | "mid" | "senior" | "lead" | "expert",
  "focusAreas": ["<5-8 specific topics/skills/projects from THIS resume that an interviewer should probe to validate real depth>"],
  "headline": "<one short sentence describing this person, e.g. 'Senior backend engineer with 8 years in payments infrastructure'>"
}

Rules:
- domain must be specific to what they ACTUALLY did, not a generic title.
- focusAreas must be drawn from real projects, technologies, or responsibilities named in the resume.
- Do not invent anything not supported by the resume.

RESUME:
${resumeText.slice(0, 12000)}`

  try {
    const result = await callGemini({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.2, maxOutputTokens: 800, thinkingConfig: { thinkingBudget: 0 } },
    })
    if (!result.ok) {
      return NextResponse.json({ error: result.data?.error?.message || 'AI error' }, { status: result.status })
    }
    const parsed = JSON.parse(stripJsonFences(textFrom(result.data)))
    return NextResponse.json({
      name: fullName,
      domain: parsed.domain || 'your field',
      seniority: parsed.seniority || 'mid',
      focusAreas: Array.isArray(parsed.focusAreas) ? parsed.focusAreas.slice(0, 8) : [],
      headline: parsed.headline || '',
      resumeText,
    })
  } catch (e) {
    // Graceful fallback: still let the interview start with a generic domain.
    return NextResponse.json({
      name: fullName,
      domain: 'your field',
      seniority: 'mid',
      focusAreas: [],
      headline: '',
      resumeText,
      warning: 'Could not auto-detect domain; using a generic setup.',
    })
  }
}
