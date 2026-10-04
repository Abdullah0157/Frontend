// Validates every question bank under frameworks/banks/ before it can go live.
//
//   node scripts/validate-assessment-bank.mjs [--skip-python] [--only=<substring>]
//
// 1. Structure: every rule in frameworks/banks/README.md.
// 2. code_output items: the snippet in the prompt is executed (node / python3)
//    and the real output must match the keyed option.
// 3. coding items: the reference solution must pass every visible and hidden
//    test in JavaScript AND Python, run through the same sandbox candidates
//    use (lib/code-runner.js); every known-wrong solution must fail at least
//    one hidden test. A test suite that passes wrong code is a broken test.
// Python runs need a Piston runner: CODE_RUNNER_URL=http://127.0.0.1:2000
// Exit code 1 if anything fails.

import { execFileSync } from 'node:child_process'
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadBankFiles, checkBank } from '../lib/assessment-bank.js'
import { runTests } from '../lib/code-runner.js'

const args = process.argv.slice(2)
const skipPython = args.includes('--skip-python')
const only = (args.find((a) => a.startsWith('--only=')) || '').slice(7)
const root = fileURLToPath(new URL('../frameworks/banks', import.meta.url))

const { items: all, errors: loadErrors } = loadBankFiles(root)
const items = only ? all.filter((i) => i.__file.includes(only) || i.bank_key?.includes(only)) : all
const errors = [...loadErrors, ...checkBank(items)]
const warnings = []

// ── code_output: run the snippet, compare with the key ────────────────────
const norm = (s) => String(s).replace(/`/g, '').replace(/[\s,]+/g, ' ').trim().toLowerCase()
const tmp = mkdtempSync(join(tmpdir(), 'bank-'))
for (const it of items.filter((i) => i.format === 'code_output')) {
  const m = /```[a-z]*\n([\s\S]*?)```/.exec(it.prompt || '')
  if (!m) { errors.push(`${it.bank_key}: code_output prompt has no fenced code block`); continue }
  const file = join(tmp, it.language === 'python' ? 'snippet.py' : 'snippet.js')
  writeFileSync(file, m[1])
  let stdout = ''
  let errName = ''
  try {
    stdout = execFileSync(it.language === 'python' ? 'python3' : 'node', [file], { timeout: 5000, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
  } catch (e) {
    stdout = String(e.stdout || '')
    const line = String(e.stderr || '').split('\n').reverse().find((l) => /(Error|Exception)\b/.test(l)) || ''
    errName = (/([A-Za-z]*(Error|Exception))/.exec(line) || [])[1] || 'error'
  }
  const observed = [stdout, errName, `${stdout} ${errName}`].map(norm).filter(Boolean)
  const keyed = norm(it.choices[it.answer.correct])
  const matchesKey = observed.includes(keyed) || observed.some((o) => keyed.includes(o) && o.length > 0 && keyed.length - o.length < 25)
  const otherMatch = it.choices.findIndex((c, i) => i !== it.answer.correct && observed.includes(norm(c)))
  if (otherMatch !== -1) errors.push(`${it.bank_key}: real output matches option ${otherMatch}, but the key is ${it.answer.correct}. Output: ${JSON.stringify(stdout.trim() || errName)}`)
  else if (!matchesKey) warnings.push(`${it.bank_key}: could not match output automatically, check by hand. Output: ${JSON.stringify((stdout.trim() + ' ' + errName).trim())} / key: ${JSON.stringify(it.choices[it.answer.correct])}`)
}
rmSync(tmp, { recursive: true, force: true })

// ── coding: reference passes everything, wrong solutions are caught ────────
const codingResults = []
for (const it of items.filter((i) => i.type === 'coding')) {
  const c = it.coding || {}
  const tests = [...(c.visible_tests || []), ...(c.hidden_tests || [])]
  const hiddenNames = new Set((c.hidden_tests || []).map((t) => t.name))
  const langs = skipPython ? ['javascript'] : ['javascript', 'python']
  const row = { key: it.bank_key }
  for (const lang of langs) {
    const ref = await runTests({ language: lang, code: c.reference[lang], functionName: c.function_name, tests, compare: c.compare || 'exact' })
    if (ref.infraError) { errors.push(`${it.bank_key}: ${lang} runner unavailable (${ref.infraError})`); continue }
    row[`${lang}_ref`] = `${ref.passed}/${ref.total}`
    if (ref.passed !== ref.total) {
      const failed = ref.results.filter((r) => !r.passed).map((r) => `${r.name}${r.error ? ` (${r.error})` : ''}`)
      errors.push(`${it.bank_key}: ${lang} reference fails ${failed.join('; ')}`)
    }
    let caught = 0
    for (const [wi, w] of (c.wrong || []).entries()) {
      const res = await runTests({ language: lang, code: w[lang], functionName: c.function_name, tests, compare: c.compare || 'exact' })
      const failsHidden = res.results.some((r) => !r.passed && hiddenNames.has(r.name))
      if (failsHidden) caught++
      else errors.push(`${it.bank_key}: ${lang} wrong solution #${wi} ("${w.why}") passes every hidden test`)
    }
    row[`${lang}_wrong_caught`] = `${caught}/${(c.wrong || []).length}`
  }
  codingResults.push(row)
}

// ── Report ────────────────────────────────────────────────────────────────
const count = (f) => items.reduce((m, i) => { const k = f(i); m[k] = (m[k] || 0) + 1; return m }, {})
console.log(`Items: ${items.length}`)
console.log('By file:', count((i) => i.__file))
console.log('By type:', count((i) => i.type))
console.log('By difficulty:', count((i) => i.difficulty))
console.log('By level set:', count((i) => i.levels.join('+')))
console.log('Key position (mcq):', count((i) => (i.type === 'mcq' ? i.answer.correct : 'n/a')))
console.log('Best position (sjt):', count((i) => (i.type === 'sjt' ? i.answer.points.indexOf(3) : 'n/a')))
console.log('Primary skills:', Object.keys(count((i) => i.primary_skill_code)).length)
if (codingResults.length) console.table(codingResults)
for (const w of warnings) console.log(`WARN  ${w}`)
for (const e of errors) console.log(`ERROR ${e}`)
console.log(errors.length ? `\nFAILED: ${errors.length} error(s), ${warnings.length} warning(s)` : `\nOK: 0 errors, ${warnings.length} warning(s)`)
process.exit(errors.length ? 1 : 0)
