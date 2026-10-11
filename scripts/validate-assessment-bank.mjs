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
import { loadBankFiles, checkBank, itemLangs } from '../lib/assessment-bank.js'
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

// ── numbers: the keyed option must contain the result of `calc` ────────────
import vm from 'node:vm'
const numbersIn = (text) => (String(text).replace(/,(?=\d{3})/g, '').match(/-?\d+(\.\d+)?/g) || []).map(Number)
for (const it of items.filter((i) => i.format === 'numbers' && i.calc)) {
  let result
  try {
    result = Number(vm.runInNewContext(it.calc, Object.create(null), { timeout: 1000 }))
  } catch (e) {
    errors.push(`${it.bank_key}: calc does not run (${e.message})`)
    continue
  }
  if (!Number.isFinite(result)) { errors.push(`${it.bank_key}: calc gives ${result}`); continue }
  const hit = (i) => numbersIn(it.choices[i]).some((n) => Math.abs(n - result) < 0.006)
  if (!hit(it.answer.correct)) {
    errors.push(`${it.bank_key}: calc gives ${result}, which is not in the keyed option "${it.choices[it.answer.correct]}"`)
  }
  const others = it.choices.map((_, i) => i).filter((i) => i !== it.answer.correct && hit(i))
  if (others.length) errors.push(`${it.bank_key}: calc result ${result} also appears in option(s) ${others.join(', ')}`)
}

// ── coding: reference passes everything, wrong solutions are caught ────────
const codingResults = []
for (const it of items.filter((i) => i.type === 'coding')) {
  const c = it.coding || {}
  const tests = [...(c.visible_tests || []), ...(c.hidden_tests || [])]
  const hiddenNames = new Set((c.hidden_tests || []).map((t) => t.name))
  const langs = itemLangs(it).filter((l) => !(skipPython && l === 'python'))
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

// ── Test-wiseness cues (per file, warnings) ───────────────────────────────
// A candidate who knows nothing should not be able to guess from the shape of
// the options. Two cues reviewers found by hand, now measured every run:
//   - the keyed option being the longest one;
//   - a justifying clause ("because", "since", "so that"...) appearing much
//     more (or much less) often in good options than in bad ones.
const JUSTIFY = /\b(because|since|so that|so it|so the|so we|so you|which means|as it|in order to)\b/i
const cueRows = []
const byFile = items.reduce((m, it) => ((m[it.__file] ||= []).push(it), m), {})
for (const [file, list] of Object.entries(byFile)) {
  const mcq = list.filter((i) => i.type === 'mcq' && i.format !== 'code_output')
  if (mcq.length >= 10) {
    const longest = mcq.filter((i) => {
      const lens = i.choices.map((c) => c.length)
      return lens[i.answer.correct] === Math.max(...lens) && lens.filter((l) => l === Math.max(...lens)).length === 1
    }).length
    const share = longest / mcq.length
    cueRows.push({ file, kind: 'mcq key is longest', value: `${Math.round(share * 100)}%` })
    if (share > 0.4) warnings.push(`${file}: the key is the longest option in ${Math.round(share * 100)}% of mcq items (aim for under 40%)`)
  }
  const sjt = list.filter((i) => i.type === 'sjt')
  if (sjt.length >= 10) {
    const rate = (pred) => {
      const opts = sjt.flatMap((i) => i.choices.map((c, k) => ({ c, p: i.answer.points[k] }))).filter((o) => pred(o.p))
      return opts.length ? opts.filter((o) => JUSTIFY.test(o.c)).length / opts.length : 0
    }
    const best = rate((p) => p === 3)
    const worst = rate((p) => p <= 1)
    cueRows.push({ file, kind: 'sjt justified: best vs 0-1 point', value: `${Math.round(best * 100)}% vs ${Math.round(worst * 100)}%` })
    if (Math.abs(best - worst) > 0.25) warnings.push(`${file}: justifying clauses appear in ${Math.round(best * 100)}% of best options but ${Math.round(worst * 100)}% of 0-1 point options (keep within 25 points)`)
    const longestBest = sjt.filter((i) => {
      const lens = i.choices.map((c) => c.length)
      const b = i.answer.points.indexOf(3)
      return lens[b] === Math.max(...lens) && lens.filter((l) => l === Math.max(...lens)).length === 1
    }).length / sjt.length
    cueRows.push({ file, kind: 'sjt best is longest', value: `${Math.round(longestBest * 100)}%` })
    if (longestBest > 0.4) warnings.push(`${file}: the best option is the longest in ${Math.round(longestBest * 100)}% of sjt items (aim for under 40%)`)
  }
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
if (cueRows.length) console.table(cueRows)
for (const w of warnings) console.log(`WARN  ${w}`)
for (const e of errors) console.log(`ERROR ${e}`)
console.log(errors.length ? `\nFAILED: ${errors.length} error(s), ${warnings.length} warning(s)` : `\nOK: 0 errors, ${warnings.length} warning(s)`)
process.exit(errors.length ? 1 : 0)
