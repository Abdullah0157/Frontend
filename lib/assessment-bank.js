// Question-bank files (frameworks/banks/**/*.json): load, check against the
// rules in frameworks/banks/README.md, and map to `items` rows. Used by
// scripts/validate-assessment-bank.mjs and scripts/seed-assessment-bank.mjs.

import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { createHash } from 'node:crypto'
import { ALLOWED_SKILLS } from './skill-codes.js'

const TYPES_BY_SECTION = {
  knowledge: ['mcq', 'multi_select'],
  coding: ['coding'],
  review: ['code_review'],
  judgement: ['sjt', 'scenario_response'],
  reasoning: ['mcq'],
}
const TRACKS = ['backend', 'frontend', 'fullstack', 'mobile', 'qa', 'devops']
const LEVELS = ['L2', 'L3', 'L4', 'L5']
const LANGS = ['javascript', 'python']
const FORMATS = ['concept', 'code_output', 'find_bug', 'pr_feedback', 'incident']
const KEY_RE = /^[a-z0-9]+(\.[a-z0-9-]+)+$/
const BANNED_OPTION = /\b(all|none) of the above\b/i
const IDENT = /^[A-Za-z_$][A-Za-z0-9_$]*$/

export function loadBankFiles(root) {
  const files = []
  const walk = (dir) => {
    for (const name of readdirSync(dir)) {
      const p = join(dir, name)
      if (statSync(p).isDirectory()) walk(p)
      else if (name.endsWith('.json')) files.push(p)
    }
  }
  walk(root)
  const items = []
  const errors = []
  for (const f of files.sort()) {
    try {
      const arr = JSON.parse(readFileSync(f, 'utf8'))
      if (!Array.isArray(arr)) throw new Error('file must be a JSON array')
      arr.forEach((it, i) => items.push({ ...it, __file: relative(root, f), __index: i }))
    } catch (e) {
      errors.push(`${relative(root, f)}: ${e.message}`)
    }
  }
  return { items, errors }
}

const isJsonValue = (v) => {
  if (v === null || typeof v === 'string' || typeof v === 'boolean') return true
  if (typeof v === 'number') return Number.isFinite(v)
  if (Array.isArray(v)) return v.every(isJsonValue)
  if (typeof v === 'object') return Object.values(v).every(isJsonValue)
  return false
}

function checkTests(where, tests, min, max, errs) {
  if (!Array.isArray(tests) || tests.length < min || tests.length > max) {
    errs.push(`${where}: needs ${min}-${max} tests, has ${Array.isArray(tests) ? tests.length : 'none'}`)
    return
  }
  for (const t of tests) {
    if (!t.name || !Array.isArray(t.calls) || t.calls.length === 0) errs.push(`${where}: test "${t.name}" needs a name and calls`)
    for (const c of t.calls || []) {
      if (!Array.isArray(c.args) || !isJsonValue(c.args) || !('expected' in c) || !isJsonValue(c.expected)) {
        errs.push(`${where}: test "${t.name}" has a call that is not JSON-only args/expected`)
      }
    }
  }
}

export function itemLangs(it) {
  return Array.isArray(it.languages) && it.languages.length ? it.languages : LANGS
}
const pick = (obj, keys) => Object.fromEntries(keys.filter((k) => obj && k in obj).map((k) => [k, obj[k]]))

// Structural checks (no code execution). Returns a list of error strings.
export function checkItem(it) {
  const errs = []
  const at = `${it.__file}#${it.__index} ${it.bank_key || '(no bank_key)'}`
  const need = (cond, msg) => { if (!cond) errs.push(`${at}: ${msg}`) }

  need(typeof it.bank_key === 'string' && KEY_RE.test(it.bank_key), 'bad bank_key')
  need(TYPES_BY_SECTION[it.section]?.includes(it.type), `type ${it.type} not allowed in section ${it.section}`)
  need(Array.isArray(it.tracks) && it.tracks.length > 0 && it.tracks.every((t) => TRACKS.includes(t)), 'bad tracks')
  need(Array.isArray(it.levels) && it.levels.length > 0 && it.levels.every((l) => LEVELS.includes(l)), 'bad levels')
  need(it.language == null || LANGS.includes(it.language), 'bad language')
  need(['easy', 'medium', 'hard'].includes(it.difficulty), 'bad difficulty')
  need(ALLOWED_SKILLS.has(it.primary_skill_code), `unknown primary skill ${it.primary_skill_code}`)
  need(Array.isArray(it.secondary_skill_codes || []) && (it.secondary_skill_codes || []).length <= 2 &&
    (it.secondary_skill_codes || []).every((c) => ALLOWED_SKILLS.has(c)), 'bad secondary skills')
  need(typeof it.prompt === 'string' && it.prompt.trim().length >= 20, 'prompt too short')
  need(Number.isInteger(it.expected_time_s) && it.expected_time_s >= 20, 'bad expected_time_s')
  if (it.format != null) need(FORMATS.includes(it.format), 'bad format')
  if (it.group != null) need(typeof it.group === 'string' && /^[a-z0-9-]+$/.test(it.group), 'bad group (lowercase slug)')

  if (it.type === 'mcq' || it.type === 'multi_select' || it.type === 'sjt') {
    need(typeof it.explanation === 'string' && it.explanation.length >= 30, 'explanation missing or too short')
    const ch = it.choices
    need(Array.isArray(ch) && ch.every((c) => typeof c === 'string' && c.trim()), 'choices must be strings')
    need(!(ch || []).some((c) => BANNED_OPTION.test(c)), 'no "all/none of the above" (options are shuffled)')
    need(new Set((ch || []).map((c) => c.trim().toLowerCase())).size === (ch || []).length, 'duplicate choices')
  }
  if (it.type === 'mcq') {
    need(it.choices?.length === 4, 'mcq needs 4 choices')
    need(Number.isInteger(it.answer?.correct) && it.answer.correct >= 0 && it.answer.correct < (it.choices?.length || 0), 'bad mcq answer')
    if (it.format === 'code_output') need(it.language != null, 'code_output needs a language')
  }
  if (it.type === 'multi_select') {
    const n = it.choices?.length || 0
    const c = it.answer?.correct
    need(n >= 4 && n <= 6, 'multi_select needs 4-6 choices')
    need(Array.isArray(c) && c.length >= 2 && c.length <= 3 && new Set(c).size === c.length &&
      c.every((x) => Number.isInteger(x) && x >= 0 && x < n), 'multi_select needs 2-3 valid correct indexes')
    need(/select all that apply/i.test(it.prompt || ''), 'multi_select prompt must say "Select all that apply"')
  }
  if (it.type === 'sjt') {
    const p = it.answer?.points
    need(it.choices?.length === 4, 'sjt needs 4 choices')
    need(Array.isArray(p) && p.length === (it.choices?.length || 0) && p.every((x) => Number.isInteger(x) && x >= 0 && x <= 3), 'sjt points must be 0-3 per option')
    need((p || []).filter((x) => x === 3).length === 1, 'sjt needs exactly one 3-point option')
    need((p || []).some((x) => x <= 1), 'sjt needs at least one option scoring 0 or 1')
  }
  // Coding and code-review items are written in `languages` (default both).
  const langs = itemLangs(it)
  if (it.type === 'coding' || it.type === 'code_review') {
    need(langs.length > 0 && langs.every((l) => LANGS.includes(l)), 'languages must be javascript and/or python')
  }
  if (it.type === 'coding') {
    const c = it.coding || {}
    need(langs.every((l) => IDENT.test(c.function_name?.[l] || '')), `function_name needs ${langs.join(' and ')} identifiers`)
    need(langs.every((l) => typeof c.starter?.[l] === 'string'), `starter needs ${langs.join(' and ')}`)
    need(langs.every((l) => typeof c.reference?.[l] === 'string'), `reference needs ${langs.join(' and ')}`)
    need(['exact', 'unordered', 'float'].includes(c.compare || 'exact'), 'bad compare mode')
    need(Array.isArray(c.wrong) && c.wrong.length >= 1 && c.wrong.every((w) => langs.every((l) => typeof w[l] === 'string')), `needs wrong solutions in ${langs.join(' and ')}`)
    checkTests(`${at} visible_tests`, c.visible_tests, 2, 3, errs)
    checkTests(`${at} hidden_tests`, c.hidden_tests, 8, 15, errs)
  }
  if (it.type === 'code_review') {
    const r = it.review || {}
    need(langs.every((l) => typeof r.code?.[l] === 'string' && r.code[l].trim()), `review.code needs ${langs.join(' and ')}`)
    need(Array.isArray(r.issues) && r.issues.length >= 3 && r.issues.length <= 5, 'review needs 3-5 issues')
    need((r.issues || []).every((i) => i.id && ['critical', 'major', 'minor'].includes(i.severity) &&
      Number.isInteger(i.points) && i.points >= 1 && i.points <= 3 && i.description), 'bad review issue')
    need(typeof r.ideal_answer === 'string' && r.ideal_answer.length > 40, 'review needs ideal_answer')
  }
  return errs
}

export function checkBank(items) {
  const errors = []
  const seen = new Map()
  for (const it of items) {
    errors.push(...checkItem(it))
    if (seen.has(it.bank_key)) errors.push(`duplicate bank_key ${it.bank_key} (${seen.get(it.bank_key)} and ${it.__file})`)
    seen.set(it.bank_key, it.__file)
  }
  return errors
}

const DIFFICULTY_BETA = { easy: -1, medium: 0, hard: 1 }

// Split an item into what the candidate may see (`content`) and what stays on
// the server (`scoring_rubric`).
export function toItemRow(it) {
  let content = {}
  let rubric = {}
  let reference = it.explanation || null
  if (it.type === 'mcq' || it.type === 'multi_select' || it.type === 'sjt') {
    content = { choices: it.choices }
    rubric = { answer: it.answer }
  } else if (it.type === 'coding') {
    const c = it.coding
    const langs = itemLangs(it)
    content = { function_name: pick(c.function_name, langs), starter: pick(c.starter, langs), visible_tests: c.visible_tests }
    rubric = { compare: c.compare || 'exact', hidden_tests: c.hidden_tests, reference: pick(c.reference, langs), wrong: c.wrong, quality_focus: c.quality_focus || [] }
  } else if (it.type === 'code_review') {
    content = { code_by_language: pick(it.review.code, itemLangs(it)) }
    rubric = { issues: it.review.issues, ideal_answer: it.review.ideal_answer }
    reference = it.review.ideal_answer
  } else if (it.type === 'scenario_response') {
    rubric = { dimensions: it.dimensions || [] }
    reference = it.reference_answer || it.explanation || null
  }
  const row = {
    bank_key: it.bank_key,
    type: it.type,
    modality: it.type === 'coding' ? 'ide' : 'written',
    section: it.section,
    format: it.format || null,
    language: it.language || null,
    difficulty: it.difficulty,
    tracks: it.tracks,
    levels: it.levels,
    primary_skill_code: it.primary_skill_code,
    secondary_skill_codes: it.secondary_skill_codes || [],
    prompt: it.prompt,
    reference_answer: reference,
    content,
    scoring_rubric: rubric,
    expected_time_s: it.expected_time_s,
    difficulty_beta: DIFFICULTY_BETA[it.difficulty] ?? 0,
    tags: [it.section, it.format, it.group ? `group:${it.group}` : null].filter(Boolean),
  }
  // Hash EVERY stored field, not just the text: a change to tracks, levels,
  // skills or group must reach the database too (the seeder skips unchanged
  // hashes).
  row.content_hash = createHash('sha256').update(JSON.stringify(row)).digest('hex')
  return row
}
