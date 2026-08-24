// Deterministic (no-AI) resume extraction.
//
// Handles the parts of a resume that are mechanically identifiable — contact
// details and section boundaries — with plain code. No model, no tokens, no
// network, no hallucination. Whatever this returns is a fact read straight out
// of the document, so it should WIN over anything the LLM guesses.
//
// The section splitter borrows OpenResume's core idea (MIT): resumes are read
// visually, so headings are found by shape (short, standalone, uppercase-ish)
// rather than by exact string match.
//
// What this deliberately does NOT do: decide which bullet belongs to which job,
// summarise, or infer a degree major. Those need judgement — that's the LLM's job.

// ── Normalisation ────────────────────────────────────────────────────────────
// PDF letter-spacing extracts as "E X P E R I E N C E" / "S U M M A RY". Any
// naive keyword match misses those entirely, so collapse them back first.
// Returns { text, wasSpaced }. When display letter-spacing is stripped, the gap
// between WORDS is lost too ("C O R E  S K I L L S" -> "CORESKILLS"), so callers
// must match on substrings rather than word boundaries for those lines.
function unspace(line) {
  const raw = line.trim()
  const tokens = raw.split(/\s+/)
  if (tokens.length < 3) return { text: raw, wasSpaced: false }
  const singles = tokens.filter(t => t.length === 1).length
  if (singles / tokens.length >= 0.6) return { text: tokens.join(''), wasSpaced: true }
  return { text: raw, wasSpaced: false }
}

// Keyword per section. Real resumes rarely use the bare word — they write
// "SKILLS MATCHED TO THIS ROLE" or "EDUCATION AND CERTIFICATIONS" — so these are
// matched as WORDS INSIDE a heading-shaped line, not as the whole line.
const SECTION_KEYWORDS = [
  ['experience', /\b(experience|employment|work history)\b/i],
  ['education', /\b(education|academics?|qualifications?)\b/i],
  ['skills', /\b(skills|competencies|expertise|technologies|tech stack)\b/i],
  ['projects', /\b(projects?)\b/i],
  ['certifications', /\b(certifications?|licenses?|courses?)\b/i],
  ['awards', /\b(awards?|honou?rs?|achievements?)\b/i],
  ['publications', /\b(publications?|papers?|research)\b/i],
  ['languages', /\b(languages?)\b/i],
  ['summary', /\b(summary|profile|objective|about me|overview)\b/i],
  ['links', /\b(links?|online presence)\b/i],
]

// A line is heading-SHAPED if it's short, few words, has no sentence punctuation,
// and is visually set apart (ALL CAPS or Title Case). This is the OpenResume
// insight: find headings by shape first, then decide what they mean.
function isHeadingShaped(line) {
  if (!line || line.length > 60) return false
  const words = line.split(/\s+/)
  if (words.length > 6) return false
  if (/[.;,]$/.test(line)) return false           // sentences aren't headings
  const letters = line.replace(/[^A-Za-z]/g, '')
  if (letters.length < 3) return false
  const upper = line.replace(/[^A-Z]/g, '').length
  const isAllCaps = upper / letters.length >= 0.8
  const isTitleCase = words.every(w => /^[A-Z&]/.test(w) || /^(and|of|the|to|for|this|my)$/i.test(w))
  return isAllCaps || isTitleCase
}

function headingKey(rawLine) {
  const { text, wasSpaced } = unspace(rawLine)
  const cleaned = text.replace(/[:–—|•·]+\s*$/, '').trim()
  if (!isHeadingShaped(cleaned)) return null
  for (const [key, re] of SECTION_KEYWORDS) {
    // De-spaced lines lost their word gaps, so \b can never match inside them —
    // fall back to a plain substring test for those.
    const usable = wasSpaced ? new RegExp(re.source.replace(/\\b/g, ''), 'i') : re
    if (usable.test(cleaned)) return key
  }
  return null
}

// ── Contact details (pure regex — deterministic and complete) ────────────────
const RE = {
  email: /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/,
  // International or local, 9+ digits, tolerant of () . - and spaces.
  phone: /(?:\+\d{1,3}[\s.-]?)?(?:\(\d{2,4}\)[\s.-]?)?\d[\d\s().-]{7,}\d/,
  linkedinUrl: /(?:https?:\/\/)?(?:[a-z]{2,3}\.)?linkedin\.com\/(?:in|pub)\/[A-Za-z0-9_-]+\/?/i,
  githubUrl: /(?:https?:\/\/)?(?:www\.)?github\.com\/[A-Za-z0-9_-]+\/?/i,
  url: /(?:https?:\/\/)?(?:www\.)?[A-Za-z0-9-]+\.(?:com|dev|io|ai|net|org|app|me|co)(?:\/[^\s|•·]*)?/gi,
}

function looksLikeName(line) {
  const t = line.trim()
  if (!t || t.length > 45) return false
  if (/[@\d]/.test(t)) return false
  if (/https?:|www\./i.test(t)) return false
  const words = t.split(/\s+/)
  if (words.length < 2 || words.length > 4) return false
  return words.every(w => /^[A-Za-z][A-Za-z'’.-]*$/.test(w))
}

function cleanPhone(raw) {
  if (!raw) return ''
  const digits = raw.replace(/[^\d+]/g, '')
  // 9-15 digits is the real-world range; anything else is a date or an ID.
  const count = digits.replace(/\D/g, '').length
  return count >= 9 && count <= 15 ? raw.trim() : ''
}

export function extractContact(text) {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean)
  // Contact details live in the header — search the top of the document first
  // so we don't pick up a client's email out of a job description further down.
  const head = lines.slice(0, 12).join('\n')

  const email = (head.match(RE.email) || text.match(RE.email) || [''])[0]
  const linkedin = (text.match(RE.linkedinUrl) || [''])[0]
  const github = (text.match(RE.githubUrl) || [''])[0]

  // Phone: only search lines that aren't obviously dates.
  let phone = ''
  for (const l of lines.slice(0, 12)) {
    if (/\b(19|20)\d{2}\s*[-–]\s*((19|20)\d{2}|present)/i.test(l)) continue
    const hit = cleanPhone((l.match(RE.phone) || [''])[0])
    if (hit) { phone = hit; break }
  }

  const full_name = (lines.find(looksLikeName) || '').trim()

  // "City, Country" in the header block.
  let city = '', country = ''
  for (const l of lines.slice(0, 8)) {
    for (const part of l.split(/[|•·]/)) {
      const m = part.trim().match(/^([A-Z][A-Za-z .'-]{2,25}),\s*([A-Z][A-Za-z .'-]{2,25})$/)
      if (m) { city = m[1].trim(); country = m[2].trim(); break }
    }
    if (city) break
  }

  return {
    full_name,
    email: email || '',
    phone,
    city,
    country,
    linkedin: linkedin ? (linkedin.startsWith('http') ? linkedin : `https://${linkedin}`) : '',
    github: github ? (github.startsWith('http') ? github : `https://${github}`) : '',
  }
}

// ── Section splitting ────────────────────────────────────────────────────────
// Returns { summary: "...", experience: "...", ... } as raw text blocks.
export function splitSections(text) {
  const lines = text.split('\n')
  const found = []
  lines.forEach((line, i) => {
    const key = headingKey(line)
    if (key) found.push({ key, i })
  })
  const sections = {}
  found.forEach((h, idx) => {
    const end = idx + 1 < found.length ? found[idx + 1].i : lines.length
    const body = lines.slice(h.i + 1, end).join('\n').trim()
    // Keep the first occurrence of a section; later repeats are usually
    // page-header artifacts.
    if (body && !sections[h.key]) sections[h.key] = body
  })
  return { sections, headings: found.map(f => f.key) }
}

// Convenience: everything the deterministic layer can know, in one call.
export function parseDeterministic(text) {
  const contact = extractContact(text)
  const { sections, headings } = splitSections(text)
  return { contact, sections, headings }
}
