// Diagnose a single resume parse: shows raw model output length, where the JSON
// breaks, and whether it was truncated. Usage: node --env-file=.env.local scripts/diagnose-one-resume.mjs "<pdf path>"
import { readFileSync, writeFileSync } from 'fs'
import { extractText, getDocumentProxy } from 'unpdf'

const file = process.argv[2]
const MODEL = process.env.NEXT_PUBLIC_GEMINI_MODEL || 'gemini-2.5-flash'
const KEYS = [process.env.GEMINI_API_KEY, process.env.GEMINI_API_KEY_FALLBACK].filter(Boolean)

const routeSrc = readFileSync(new URL('../app/api/parse-resume/route.js', import.meta.url), 'utf8')
const PROMPT_HEAD = routeSrc.match(/const prompt = `([\s\S]*?)\nRESUME:\n\$\{resumeText/)[1]

const buf = new Uint8Array(readFileSync(file))
const pdf = await getDocumentProxy(buf)
const { totalPages, text } = await extractText(pdf, { mergePages: true })
console.log(`PDF: ${totalPages} pages, ${text.length} chars of text`)

const body = {
  contents: [{ role: 'user', parts: [{ text: `${PROMPT_HEAD}\nRESUME:\n${text.slice(0, 14000)}` }] }],
  generationConfig: { temperature: 0.1, maxOutputTokens: 4096, thinkingConfig: { thinkingBudget: 0 } },
}
const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${KEYS[0]}`,
  { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
const d = await r.json()
const cand = d?.candidates?.[0]
const raw = cand?.content?.parts?.[0]?.text || ''

console.log(`finishReason: ${cand?.finishReason}`)
console.log(`output chars: ${raw.length}`)
console.log(`usage:`, JSON.stringify(d?.usageMetadata || {}))
console.log(`\n--- last 260 chars of model output ---`)
console.log(raw.slice(-260))

try {
  const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim()
  JSON.parse(cleaned.match(/\{[\s\S]*\}/)[0])
  console.log('\nJSON: parsed OK')
} catch (e) {
  console.log(`\nJSON ERROR: ${e.message}`)
}
writeFileSync('/tmp/raw-parse-out.txt', raw)
console.log('raw saved to /tmp/raw-parse-out.txt')
