// Benchmark the no-AI parser against real resumes.
//
// Measures, per field, whether the deterministic layer found the value that is
// verifiably present in the raw text. Ground truth is the document itself: if a
// regex-independent check proves an email exists, the parser must find one.
//
// Run: node --env-file=.env.local scripts/benchmark-deterministic.mjs [folders...]
import { readFileSync, readdirSync } from 'fs'
import { join, basename } from 'path'
import { extractText, getDocumentProxy } from 'unpdf'
import { parseDeterministic } from '../lib/resume-deterministic.js'

const FOLDERS = process.argv.slice(2).length ? process.argv.slice(2)
  : [join(process.env.HOME, 'Desktop/Resume'), join(process.env.HOME, 'Desktop/cvs'), join(process.env.HOME, 'Desktop/AHMAD ABDULLAH')]

function walk(dir, d = 0) {
  if (d > 3) return []
  let out = []
  try {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, e.name)
      if (e.isDirectory()) out = out.concat(walk(p, d + 1))
      else if (e.name.toLowerCase().endsWith('.pdf')) out.push(p)
    }
  } catch {}
  return out
}

const files = [...new Set(FOLDERS.flatMap(f => walk(f)))]
console.log(`Benchmarking the NO-AI parser on ${files.length} resumes\n`)

// Ground truth: does the document actually contain this thing at all?
const truth = {
  email: t => /@/.test(t) && /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/.test(t),
  phone: t => /\+?\d[\d\s().-]{8,}\d/.test(t),
  linkedin: t => /linkedin\.com\/(in|pub)\//i.test(t),
  github: t => /github\.com\/[A-Za-z0-9_-]+/i.test(t),
}

const SECTIONS = ['summary', 'experience', 'education', 'skills', 'projects']
const stat = {}
const bump = (k, field) => { stat[k] ??= {}; stat[k][field] = (stat[k][field] || 0) + 1 }

const rows = []
for (const file of files) {
  const name = basename(file)
  try {
    const buf = new Uint8Array(readFileSync(file))
    const pdf = await getDocumentProxy(buf)
    const { text } = await extractText(pdf, { mergePages: true })
    if (!text || text.trim().length < 200) continue

    const { contact, sections, headings } = parseDeterministic(text)

    // Contact scoring: only count fields the document actually has.
    const contactRes = {}
    for (const f of ['email', 'phone', 'linkedin', 'github']) {
      if (!truth[f](text)) { contactRes[f] = '-'; continue }   // not present, not applicable
      bump('applicable', f)
      if (contact[f]) { contactRes[f] = 'Y'; bump('found', f) } else { contactRes[f] = 'MISS' }
    }
    // Name: applicable for every resume.
    bump('applicable', 'name')
    if (contact.full_name) bump('found', 'name')

    // Sections: only count a section as a miss if the document genuinely has
    // one. Evidence is content-based (independent of headings), so this doesn't
    // grade the detector against itself.
    const has = {
      summary: () => true,
      experience: () => /\b(19|20)\d{2}\b/.test(text),
      education: () => /universit|college|bachelor|master|b\.?sc|degree|intermediate|diploma/i.test(text),
      skills: () => /\b(python|javascript|react|sql|docker|node|aws|typescript)\b/i.test(text),
      projects: () => (text.match(/\bproject/gi) || []).length >= 2,
    }
    for (const s of SECTIONS) {
      if (!has[s]()) continue                 // section genuinely absent → not applicable
      bump('applicable', s)
      if (headings.includes(s)) bump('found', s)
    }

    rows.push({ name, contact, headings, sectionCount: Object.keys(sections).length, contactRes })
    const c = contactRes
    console.log(
      `${name.slice(0, 42).padEnd(44)} name:${contact.full_name ? 'Y' : 'MISS'.padEnd(4)} ` +
      `email:${c.email} phone:${c.phone} li:${c.linkedin} gh:${c.github}  ` +
      `sections:[${headings.join(',') || 'NONE'}]`
    )
  } catch (e) {
    console.log(`${name.slice(0, 42).padEnd(44)} FAIL ${e.message}`)
  }
}

console.log(`\n${'='.repeat(76)}`)
console.log('DETERMINISTIC PARSER ACCURACY (only counting what the document actually contains)\n')
const pct = (f) => {
  const a = stat.applicable?.[f] || 0, g = stat.found?.[f] || 0
  return a ? `${g}/${a}  ${String(Math.round(g / a * 100)).padStart(3)}%` : 'n/a'
}
console.log('  CONTACT DETAILS')
for (const f of ['name', 'email', 'phone', 'linkedin', 'github']) console.log(`    ${f.padEnd(10)} ${pct(f)}`)
console.log('\n  SECTION DETECTION')
for (const s of SECTIONS) console.log(`    ${s.padEnd(10)} ${pct(s)}`)

const noSections = rows.filter(r => r.headings.length === 0).length
console.log(`\n  Resumes where NO section headings were found: ${noSections}/${rows.length}`)
