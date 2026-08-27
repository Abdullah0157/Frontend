// Compare the ORIGINAL single-pass prompt vs the SLIM judgment-only prompt,
// both running on the free local model. Answers: can parsing run fully local,
// and does narrowing the task actually help a small model?
import { readFileSync, readdirSync } from 'fs'
import { join, basename } from 'path'
import { extractText, getDocumentProxy } from 'unpdf'
import { parseDeterministic } from '../lib/resume-deterministic.js'
import { buildJudgmentPrompt } from '../lib/resume-prompt.js'

const MODEL = process.env.OLLAMA_MODEL || 'qwen3:4b'
const BASE = process.env.OLLAMA_BASE_URL || 'http://localhost:11434'
const routeSrc = readFileSync(new URL('../app/api/parse-resume/route.js', import.meta.url), 'utf8')
const FULL_HEAD = routeSrc.match(/const prompt = `([\s\S]*?)\nRESUME:\n\$\{resumeText/)[1]

async function ask(prompt) {
  const t = Date.now()
  const r = await fetch(`${BASE}/api/chat`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: MODEL, stream: false, think: false, format: 'json',
      options: { temperature: 0.1, num_predict: 8192 },
      messages: [{ role: 'user', content: prompt }],
    }),
  })
  const d = await r.json().catch(() => ({}))
  return {
    text: d?.message?.content || '',
    secs: Math.round((Date.now() - t) / 1000),
    inTok: d?.prompt_eval_count || 0,
    outTok: d?.eval_count || 0,
  }
}

function score(raw) {
  try {
    const s = JSON.parse(String(raw).match(/\{[\s\S]*\}/)[0])
    const exp = Array.isArray(s.experience) ? s.experience : []
    const bullets = exp.map(e => (e.bullets || []).length)
    // A job with zero bullets while another has 3+ is the mis-assignment bug.
    const misassigned = exp.length > 1 && bullets.some(b => b === 0) && Math.max(...bullets) >= 3
    return { ok: true, exp: exp.length, edu: (s.education || []).length, proj: (s.projects || []).length,
      skills: (s.skills || []).length, bullets, misassigned, summary: !!s.summary }
  } catch (e) { return { ok: false, err: e.message.slice(0, 50) } }
}

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

const N = Number(process.env.N || 4)
const files = [...new Set([join(process.env.HOME, 'Desktop/cvs'), join(process.env.HOME, 'Desktop/Resume')].flatMap(f => walk(f)))].slice(0, N)
console.log(`Local model: ${MODEL}   ·   ${files.length} resumes\n`)

const agg = { full: { tok: 0, secs: 0, ok: 0, mis: 0 }, slim: { tok: 0, secs: 0, ok: 0, mis: 0 } }

for (const file of files) {
  const buf = new Uint8Array(readFileSync(file))
  const pdf = await getDocumentProxy(buf)
  const { text } = await extractText(pdf, { mergePages: true })
  const { sections } = parseDeterministic(text)

  console.log(`── ${basename(file).slice(0, 46)}`)
  for (const [label, prompt] of [
    ['full', `${FULL_HEAD}\nRESUME:\n${text.slice(0, 30000)}`],
    ['slim', buildJudgmentPrompt(sections, text)],
  ]) {
    const r = await ask(prompt)
    const s = score(r.text)
    agg[label].tok += r.inTok + r.outTok
    agg[label].secs += r.secs
    if (s.ok) { agg[label].ok++; if (s.misassigned) agg[label].mis++ }
    console.log(s.ok
      ? `   ${label.padEnd(4)} ${String(r.secs).padStart(3)}s  ${String(r.inTok).padStart(5)}in/${String(r.outTok).padStart(4)}out  exp:${s.exp} edu:${s.edu} proj:${s.proj} skills:${s.skills} bullets:[${s.bullets}]${s.misassigned ? '  ⚠ MIS-ASSIGNED' : ''}`
      : `   ${label.padEnd(4)} ${String(r.secs).padStart(3)}s  FAILED: ${s.err}`)
  }
}

console.log(`\n${'='.repeat(72)}`)
for (const k of ['full', 'slim']) {
  const a = agg[k]
  console.log(`${k.toUpperCase().padEnd(5)} valid:${a.ok}/${files.length}  mis-assigned:${a.mis}  avg ${Math.round(a.secs / files.length)}s  avg ${Math.round(a.tok / files.length)} tokens`)
}
const save = agg.full.tok ? Math.round((1 - agg.slim.tok / agg.full.tok) * 100) : 0
console.log(`\nSlim prompt uses ${save}% fewer tokens and is ${Math.round((1 - agg.slim.secs / agg.full.secs) * 100)}% faster.`)
