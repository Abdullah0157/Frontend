// End-to-end: PDF -> real prompt -> model -> deterministic merge, exactly as the
// production route does it. Paced for Groq's 8k tokens/min free tier.
import { readFileSync } from 'fs'
import { basename } from 'path'
import { extractText, getDocumentProxy } from 'unpdf'
import { extractContact } from '../lib/resume-deterministic.js'

const KEYS = [process.env.GEMINI_API_KEY, process.env.GEMINI_API_KEY_FALLBACK].filter(Boolean)
const MODEL = process.env.NEXT_PUBLIC_GEMINI_MODEL || 'gemini-2.5-flash'
const routeSrc = readFileSync(new URL('../app/api/parse-resume/route.js', import.meta.url), 'utf8')
const HEAD = routeSrc.match(/const prompt = `([\s\S]*?)\nRESUME:\n\$\{resumeText/)[1]
const str = v => (typeof v === 'string' ? v.trim() : '')
const pick = (d, m) => str(d) || str(m)
const sleep = ms => new Promise(r => setTimeout(r, ms))

async function model(prompt) {
  for (const k of KEYS) {
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${k}`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.1, maxOutputTokens: 8192, thinkingConfig: { thinkingBudget: 0 } } }) })
    const d = await r.json().catch(() => ({}))
    if (r.ok) return { text: d?.candidates?.[0]?.content?.parts?.[0]?.text || '', via: 'gemini' }
  }
  const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.GROQ_API_KEY}` },
    body: JSON.stringify({ model: 'openai/gpt-oss-120b', messages: [{ role: 'user', content: prompt }], temperature: 0.1, max_tokens: 4000 }) })
  const d = await r.json().catch(() => ({}))
  if (d.error) return { text: '', via: 'groq-err:' + String(d.error.message).slice(0, 60) }
  return { text: d?.choices?.[0]?.message?.content || '', via: 'groq' }
}

for (const file of process.argv.slice(2)) {
  const buf = new Uint8Array(readFileSync(file))
  const pdf = await getDocumentProxy(buf)
  const { text } = await extractText(pdf, { mergePages: true })
  const det = extractContact(text)
  const { text: raw, via } = await model(`${HEAD}\nRESUME:\n${text.slice(0, 30000)}`)

  console.log(`\n===== ${basename(file)}  (via ${via}) =====`)
  if (!raw) { console.log('  model returned nothing — deterministic contacts still available:'); console.log('  ', JSON.stringify(det)); continue }

  let s
  try { s = JSON.parse(raw.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim().match(/\{[\s\S]*\}/)[0]) }
  catch (e) { console.log('  JSON error:', e.message, '- deterministic contacts still available:', JSON.stringify(det)); continue }

  const p = s.personal || {}
  const merged = {
    full_name: pick(det.full_name, p.full_name), email: pick(det.email, p.email),
    phone: pick(det.phone, p.phone), city: pick(det.city, p.city),
    country: pick(det.country, p.country), linkedin: pick(det.linkedin, p.linkedin),
  }
  console.log('  MERGED CONTACTS:', JSON.stringify(merged))
  const diffs = Object.keys(merged).filter(k => str(p[k]) && str(p[k]) !== merged[k])
  if (diffs.length) diffs.forEach(k => console.log(`   · corrected ${k}: model said "${str(p[k])}" -> document says "${merged[k]}"`))
  const bl = (s.experience || []).map(e => (e.bullets || []).length)
  console.log(`  exp:${s.experience?.length || 0} edu:${s.education?.length || 0} proj:${s.projects?.length || 0} skills:${s.skills?.length || 0} bullets:[${bl.join(',')}]`)
  console.log(`  summary: ${(s.summary || '').slice(0, 70)}...`)
  await sleep(65000)   // Groq free tier: ~1 resume per minute
}
