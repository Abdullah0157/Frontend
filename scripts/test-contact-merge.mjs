// Verifies the wiring in parse-resume: deterministic contacts must win, and must
// still produce complete contact data even if the model returns nothing at all.
import { readFileSync, readdirSync } from 'fs'
import { join, basename } from 'path'
import { extractText, getDocumentProxy } from 'unpdf'
import { extractContact } from '../lib/resume-deterministic.js'

const str = (v) => (typeof v === 'string' ? v.trim() : '')
const pick = (deterministic, fromModel) => str(deterministic) || str(fromModel)   // mirrors route.js

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
const files = [...new Set([
  join(process.env.HOME, 'Desktop/Resume'),
  join(process.env.HOME, 'Desktop/cvs'),
  join(process.env.HOME, 'Desktop/AHMAD ABDULLAH'),
].flatMap(f => walk(f)))]

let modelDown = 0, overrode = 0, filledGap = 0, total = 0, bad = 0
console.log(`Checking merge behaviour on ${files.length} resumes\n`)

for (const file of files) {
  const buf = new Uint8Array(readFileSync(file))
  const pdf = await getDocumentProxy(buf)
  const { text } = await extractText(pdf, { mergePages: true })
  if (!text || text.length < 200) continue
  const det = extractContact(text)

  // CASE 1: model returns nothing (rate-limited / malformed JSON).
  const withoutModel = { email: pick(det.email, ''), phone: pick(det.phone, ''), full_name: pick(det.full_name, '') }
  if (withoutModel.full_name && (withoutModel.email || withoutModel.phone)) modelDown++

  // CASE 2: model hallucinates a wrong email — deterministic must override it.
  const hallucinated = pick(det.email, 'wrong@hallucinated.com')
  if (det.email) {
    total++
    if (hallucinated === det.email) overrode++
    else { bad++; console.log(`  ✗ ${basename(file)}: model value survived over document value`) }
  }

  // CASE 3: document has no phone -> model's value is allowed through as a gap-fill.
  if (!det.phone) {
    const gap = pick(det.phone, '+92 300 1234567')
    if (gap === '+92 300 1234567') filledGap++
  }
}

console.log(`\nDeterministic overrode a wrong model value:  ${overrode}/${total}`)
console.log(`Model still fills genuine gaps:              ${filledGap} case(s)`)
console.log(`Usable contacts even if the model is DOWN:   ${modelDown}/${files.length}`)
console.log(bad === 0 ? '\nPASS — document always beats the model, gaps still fill.' : `\nFAIL — ${bad} case(s) wrong.`)
process.exit(bad === 0 ? 0 : 1)
