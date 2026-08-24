// Batch-test the REAL resume parser against a folder of PDFs.
//
// It reads the live prompt straight out of app/api/parse-resume/route.js (so the
// test can never drift from production), extracts PDF text exactly like the app
// does (unpdf), calls the same model with the same settings, then audits the
// result for missing or mis-assigned data.
//
// Run: cd ~/jobstream-fe-deploy && node --env-file=.env.local scripts/test-resume-parsing.mjs
import { readFileSync, readdirSync, writeFileSync } from 'fs'
import { join, basename } from 'path'
import { extractText, getDocumentProxy } from 'unpdf'

const MODEL = process.env.NEXT_PUBLIC_GEMINI_MODEL || 'gemini-2.5-flash'
const KEYS = [process.env.GEMINI_API_KEY, process.env.GEMINI_API_KEY_FALLBACK].filter(Boolean)
const GROQ = process.env.GROQ_API_KEY
const FOLDERS = process.argv.slice(2).length ? process.argv.slice(2)
  : [join(process.env.HOME, 'Desktop/Resume'), join(process.env.HOME, 'Desktop/cvs')]

// ── Pull the production prompt out of the route (single source of truth) ──────
const routeSrc = readFileSync(new URL('../app/api/parse-resume/route.js', import.meta.url), 'utf8')
const m = routeSrc.match(/const prompt = `([\s\S]*?)\nRESUME:\n\$\{resumeText/)
if (!m) { console.error('Could not extract prompt from route.js'); process.exit(1) }
const PROMPT_HEAD = m[1]

function buildPrompt(resumeText) {
  return `${PROMPT_HEAD}\nRESUME:\n${resumeText.slice(0, 14000)}`
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms))

async function callModel(prompt) {
  const body = {
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: { temperature: 0.1, maxOutputTokens: 4096, thinkingConfig: { thinkingBudget: 0 } },
  }
  for (const key of KEYS) {
    try {
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${key}`,
        { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const d = await r.json().catch(() => ({}))
      if (r.ok) return d?.candidates?.[0]?.content?.parts?.[0]?.text || ''
      if (r.status !== 429) console.warn(`   gemini ${r.status}: ${d?.error?.message?.slice(0, 70)}`)
    } catch (e) { console.warn('   gemini net err', e.message) }
  }
  if (!GROQ) return ''
  // Groq fallback, mirroring lib/gemini.js
  const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${GROQ}` },
    body: JSON.stringify({ model: process.env.GROQ_MODEL || 'openai/gpt-oss-120b', messages: [{ role: 'user', content: prompt }], temperature: 0.1, max_tokens: 8192 }),
  })
  const d = await r.json().catch(() => ({}))
  return d?.choices?.[0]?.message?.content || ''
}

function parseJson(raw) {
  const cleaned = String(raw).replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim()
  const match = cleaned.match(/\{[\s\S]*\}/)
  if (!match) throw new Error('no JSON in response')
  return JSON.parse(match[0])
}

// ── Audit one parse against the raw resume text ──────────────────────────────
function audit(s, text) {
  const issues = []
  const low = text.toLowerCase()
  const p = s.personal || {}
  const exp = Array.isArray(s.experience) ? s.experience : []

  // 1. Contact details that exist in the resume but were not extracted
  const emailInText = (text.match(/[\w.+-]+@[\w-]+\.[\w.]+/) || [])[0]
  if (emailInText && !p.email) issues.push(`MISSED email (resume has ${emailInText})`)
  const phoneInText = /(\+?\d[\d\s().-]{8,}\d)/.test(text)
  if (phoneInText && !p.phone) issues.push('MISSED phone (resume has one)')
  if (low.includes('linkedin.com') && !p.linkedin) issues.push('MISSED linkedin')
  if (low.includes('github.com') && !p.github) issues.push('MISSED github')
  if (!p.full_name) issues.push('MISSED name')

  // 2. Core sections
  if (!s.summary) issues.push('empty summary')
  if (!exp.length) issues.push('NO experience parsed')
  if (!Array.isArray(s.skills) || !s.skills.length) issues.push('NO skills parsed')

  // 3. Bullet assignment — the bug we shipped a fix for
  const counts = exp.map(e => (Array.isArray(e.bullets) ? e.bullets.length : 0))
  if (exp.length > 1 && counts[0] === 0 && Math.max(...counts) >= 3) {
    issues.push(`BULLETS MIS-ASSIGNED (newest job has 0, another has ${Math.max(...counts)})`)
  }
  const emptyJobs = counts.filter(c => c === 0).length
  if (exp.length > 1 && emptyJobs && emptyJobs < exp.length) {
    issues.push(`${emptyJobs}/${exp.length} job(s) have no bullets`)
  }

  // 4. Grounding — every company must actually appear in the resume text
  for (const e of exp) {
    const co = String(e.company || '').trim()
    if (co && !low.includes(co.toLowerCase().slice(0, Math.min(12, co.length)))) {
      issues.push(`HALLUCINATED company "${co}"`)
    }
  }

  // 5. Missing per-job fields
  exp.forEach((e, i) => {
    const miss = ['title', 'company'].filter(k => !e[k])
    if (miss.length) issues.push(`exp[${i}] missing ${miss.join('+')}`)
    if (!e.dates && !e.startYear) issues.push(`exp[${i}] missing dates`)
  })

  return { issues, counts }
}

// ── Run ──────────────────────────────────────────────────────────────────────
function walk(dir, depth = 0) {
  if (depth > 3) return []
  let out = []
  try {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, e.name)
      if (e.isDirectory()) out = out.concat(walk(p, depth + 1))
      else if (e.name.toLowerCase().endsWith('.pdf')) out.push(p)
    }
  } catch { /* unreadable dir */ }
  return out
}
const only = process.env.ONLY_MATCH   // optional substring filter
let files = [...new Set(FOLDERS.flatMap(d => walk(d)))]
if (only) files = files.filter(f => f.includes(only))
console.log(`Testing ${files.length} resumes with the live production prompt (${MODEL})\n`)

const results = []
for (let i = 0; i < files.length; i++) {
  const file = files[i]
  const name = basename(file)
  process.stdout.write(`[${i + 1}/${files.length}] ${name.slice(0, 52).padEnd(54)}`)
  try {
    const buf = new Uint8Array(readFileSync(file))
    const pdf = await getDocumentProxy(buf)
    const { totalPages, text } = await extractText(pdf, { mergePages: true })
    if (!text || text.trim().length < 100) { console.log('SKIP (no extractable text)'); continue }

    const raw = await callModel(buildPrompt(text))
    if (!raw) { console.log('FAIL (model returned nothing)'); results.push({ name, fatal: 'no model output' }); continue }

    const s = parseJson(raw)
    const { issues, counts } = audit(s, text)
    const exp = s.experience?.length || 0
    const line = `exp:${exp} edu:${s.education?.length || 0} proj:${s.projects?.length || 0} skills:${s.skills?.length || 0} bullets:[${counts.join(',')}]`
    console.log(issues.length ? `⚠  ${line}` : `✓  ${line}`)
    issues.forEach(x => console.log(`      · ${x}`))
    results.push({ name, pages: totalPages, chars: text.length, issues, counts, sections: s })
  } catch (e) {
    console.log(`FAIL (${e.message})`)
    results.push({ name, fatal: e.message })
  }
  await sleep(3500) // stay under the 20 req/min free-tier limit
}

// ── Summary ──────────────────────────────────────────────────────────────────
const ok = results.filter(r => !r.fatal && !r.issues?.length)
const warned = results.filter(r => !r.fatal && r.issues?.length)
const failed = results.filter(r => r.fatal)
console.log(`\n${'='.repeat(64)}`)
console.log(`CLEAN: ${ok.length}   WITH ISSUES: ${warned.length}   FAILED: ${failed.length}   (of ${results.length})`)

const tally = {}
warned.forEach(r => r.issues.forEach(i => {
  const key = i.replace(/"[^"]*"/g, '"…"').replace(/\d+/g, 'N')
  tally[key] = (tally[key] || 0) + 1
}))
if (Object.keys(tally).length) {
  console.log('\nMost common problems:')
  Object.entries(tally).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => console.log(`  ${String(v).padStart(3)}x  ${k}`))
}
const out = new URL('./resume-parse-report.json', import.meta.url).pathname
writeFileSync(out, JSON.stringify(results, null, 2))
console.log(`\nFull output: ${out}`)
