// Prompt builders for resume parsing.
//
// buildJudgmentPrompt is the slim variant used once the deterministic layer has
// already done its job. It differs from the original single-pass prompt in two
// ways that matter, especially for small/local models:
//
//   1. It does NOT ask for contact details. Those are extracted by code at 100%
//      accuracy, so asking the model for them wastes tokens and invites errors.
//   2. It is fed ONLY the section text we detected, not the whole document, so
//      the model isn't re-deriving structure we already know.
//
// Research on LLM extraction is consistent that one sprawling prompt asking for
// many unrelated field types degrades accuracy; a narrower task does better.
// That is also the most likely cause of bullets being attached to the wrong job.

const ORDER = ['summary', 'experience', 'education', 'projects', 'skills',
  'certifications', 'awards', 'publications', 'languages', 'links']

export function buildJudgmentPrompt(sections, fallbackText = '') {
  // Prefer the sections we identified; fall back to raw text if heading
  // detection found nothing usable (rare — 0/16 in benchmarking).
  const present = ORDER.filter(k => sections[k])
  const body = present.length
    ? present.map(k => `## ${k.toUpperCase()}\n${sections[k]}`).join('\n\n')
    : fallbackText.slice(0, 20000)

  return `You are a precise resume parser. The document has already been split into sections for you. Convert it into JSON. Return ONLY the JSON object — no markdown, no commentary.

{
  "summary": "one-paragraph professional summary (use the resume's own wording where present)",
  "experience": [
    { "id": "exp_1", "title": "Job Title", "company": "Company", "city": "City", "country": "Country", "startYear": "2020", "endYear": "Present", "dates": "Jan 2020 – Present", "bullets": ["achievement 1", "achievement 2"] }
  ],
  "education": [ { "id": "edu_1", "degree": "Degree", "school": "School", "major": "Field", "gpa": "3.8", "startYear": "2021", "endYear": "2025" } ],
  "projects": [ { "id": "proj_1", "name": "Name", "tech": "React, Node.js", "startYear": "", "endYear": "", "description": "what it does and your role" } ],
  "skills": ["Skill1", "Skill2"],
  "certifications": [ { "id": "cert_1", "name": "Name", "issuer": "Issuer", "year": "2024" } ],
  "awards": [ { "id": "awd_1", "title": "Award", "year": "2024" } ],
  "publications": [ { "id": "pub_1", "title": "Title", "description": "venue / note" } ],
  "languages": ["English"],
  "coding_profiles": [ { "id": "cp_1", "platform": "LeetCode", "username": "handle", "url": "https://..." } ],
  "links": [ { "id": "ln_1", "label": "Portfolio", "url": "https://..." } ]
}

RULES:
- Use ONLY facts present below. Never invent a company, date, degree or skill.
- Include EVERY job, school and project. Do not merge or skip entries.
- BULLETS: keep every bullet with the job it appears under. Never move a bullet to a different job. If a job lists no bullets, give it an empty array — do not borrow from another entry.
- Dates exactly as written. Empty array [] for any section with no data.
- "skills": individual technologies/tools actually named, de-duplicated, max 30.
- Give each item a sequential id (exp_1, edu_1, proj_1, ...).

RESUME SECTIONS:
${body}`
}
