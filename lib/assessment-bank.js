// Question-bank files (frameworks/banks/**/*.json): load, check against the
// rules in frameworks/banks/README.md, and map to `items` rows. Used by
// scripts/validate-assessment-bank.mjs and scripts/seed-assessment-bank.mjs.

import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { createHash } from 'node:crypto'
import { ALLOWED_SKILLS } from './skill-codes.js'

const TYPES_BY_SECTION = {
  // Software engineering
  knowledge: ['mcq', 'multi_select'],
  coding: ['coding'],
  review: ['code_review'],
  judgement: ['sjt', 'scenario_response'],
  reasoning: ['mcq'],
  // General workplace
  workplace_judgement: ['sjt'],
  written_communication: ['scenario_response'],
  numbers: ['mcq', 'multi_select'],
  detail: ['mcq', 'multi_select'],
  instructions: ['mcq', 'multi_select'],
  // Customer service
  typing: ['typing'],
  customer_situations: ['sjt'],
  written_reply: ['scenario_response'],
  accuracy: ['mcq', 'multi_select'],
  // English
  listening: ['listening'],
  read_aloud: ['speaking'],
  repeat: ['speaking'],
  short_answers: ['speaking'],
  role_play: ['speaking'],
  reading: ['mcq'],
}
const TRACKS = ['backend', 'frontend', 'fullstack', 'mobile', 'qa', 'devops', 'general', 'customer_service', 'english']
const LEVELS = ['L2', 'L3', 'L4', 'L5', 'staff', 'manager', 'agent', 'screener', 'full']
const LANGS = ['javascript', 'python']
const FORMATS = ['concept', 'code_output', 'find_bug', 'pr_feedback', 'incident', 'numbers']
const KEY_RE = /^[a-z0-9]+(\.[a-z0-9-]+)+$/
// Neural voices used for listening clips and speaking prompts (Microsoft Edge
// voices; several English accents so listening is not only British/American).
export const VOICES = new Set([
  'en-IN-NeerjaNeural', 'en-IN-PrabhatNeural', 'en-NG-EzinneNeural', 'en-NG-AbeoNeural',
  'en-PH-RosaNeural', 'en-PH-JamesNeural', 'en-KE-AsiliaNeural', 'en-KE-ChilembaNeural',
  'en-ZA-LeahNeural', 'en-ZA-LukeNeural', 'en-SG-LunaNeural', 'en-SG-WayneNeural',
  'en-GB-SoniaNeural', 'en-GB-RyanNeural', 'en-IE-EmilyNeural', 'en-IE-ConnorNeural',
  'en-US-JennyNeural', 'en-US-GuyNeural', 'en-AU-NatashaNeural', 'en-AU-WilliamMultilingualNeural',
  'en-CA-ClaraNeural', 'en-CA-LiamNeural',
])
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
    if (it.format === 'numbers') need(typeof it.calc === 'string' && it.calc.trim(), 'numbers items need a `calc` expression the validator can run')
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
  if (it.type === 'scenario_response' && it.writing) {
    const w = it.writing
    need(Number.isInteger(w.min_words) && Number.isInteger(w.max_words) && w.min_words >= 20 && w.max_words > w.min_words, 'writing needs min_words < max_words')
    need(Array.isArray(w.dimensions) && w.dimensions.length >= 3 && w.dimensions.length <= 5 &&
      w.dimensions.every((d) => d.name && Number(d.weight) > 0 && d.low && d.high), 'writing needs 3-5 dimensions with name, weight, low, high')
    const total = (w.dimensions || []).reduce((a, d) => a + Number(d.weight || 0), 0)
    need(Math.abs(total - 1) < 0.01, `writing dimension weights must add up to 1 (now ${total.toFixed(2)})`)
    need(typeof w.ideal_answer === 'string' && w.ideal_answer.split(/\s+/).length >= w.min_words, 'writing needs an ideal_answer at least min_words long')
    need(Array.isArray(w.must_include || []) && Array.isArray(w.must_avoid || []), 'must_include / must_avoid must be arrays')
  }
  if (it.type === 'scenario_response' && !it.writing && !it.dimensions) {
    need(false, 'scenario_response needs a writing block')
  }
  if (it.type === 'typing') {
    const t = it.typing || {}
    const words = String(t.passage || '').trim().split(/\s+/).length
    need(words >= 180 && words <= 280, `typing passage needs 180-280 words (has ${words})`)
    need(/^[\x20-\x7E\n]+$/.test(t.passage || ''), 'typing passage must use plain keyboard characters (straight quotes, no special symbols)')
    need(Number.isInteger(t.seconds) && t.seconds >= 60 && t.seconds <= 300, 'typing seconds must be 60-300')
  }
  if (it.type === 'listening' || it.type === 'speaking') {
    need(['A1', 'A2', 'B1', 'B2', 'C1', 'C2'].includes(it.cefr), 'English items need a cefr level (A1-C2)')
  }
  if (it.type === 'listening') {
    const lines = it.audio?.lines || []
    const words = lines.reduce((a, l) => a + String(l.text || '').split(/\s+/).filter(Boolean).length, 0)
    need(lines.length >= 1 && lines.length <= 6 && lines.every((l) => VOICES.has(l.voice) && l.text), 'listening audio needs 1-6 lines, each with an allowed voice and text')
    need(words >= 25 && words <= 140, `listening audio needs 25-140 words (has ${words})`)
    need(it.choices?.length === 4 && Number.isInteger(it.answer?.correct), 'listening needs 4 choices and a correct index')
    need(typeof it.explanation === 'string' && it.explanation.length >= 30, 'listening needs an explanation')
    need(!/\b(all|none) of the above\b/i.test((it.choices || []).join(' ')), 'no all/none of the above')
  }
  if (it.type === 'speaking') {
    const sp = it.speaking || {}
    const mode = sp.mode
    need(['read_aloud', 'repeat', 'short_answer', 'role_play'].includes(mode), 'speaking.mode must be read_aloud, repeat, short_answer or role_play')
    need(({ read_aloud: 'read_aloud', repeat: 'repeat', short_answer: 'short_answers', role_play: 'role_play' })[mode] === it.section, 'speaking.mode does not match the section')
    need(Number.isInteger(sp.max_seconds) && sp.max_seconds >= 5 && sp.max_seconds <= 90, 'speaking.max_seconds must be 5-90')
    need(Number.isInteger(sp.prep_seconds ?? 0) && (sp.prep_seconds ?? 0) <= 30, 'speaking.prep_seconds must be 0-30')
    const wc = (t) => String(t || '').split(/\s+/).filter(Boolean).length
    if (mode === 'read_aloud') need(wc(sp.text) >= 35 && wc(sp.text) <= 80, 'read_aloud text needs 35-80 words')
    if (mode !== 'read_aloud') {
      const lines = sp.audio?.lines || []
      need(lines.length >= 1 && lines.every((l) => VOICES.has(l.voice) && l.text), 'speaking prompt audio needs lines with allowed voices')
    }
    if (mode === 'repeat') {
      need(wc(sp.audio?.lines?.[0]?.text) >= 5 && wc(sp.audio?.lines?.[0]?.text) <= 18, 'repeat sentence needs 5-18 words')
      need(sp.audio?.lines?.length === 1, 'repeat has exactly one line (the sentence to repeat)')
    }
    if (mode === 'short_answer') need(Array.isArray(sp.acceptable) && sp.acceptable.length >= 1, 'short_answer needs acceptable answers')
    if (mode === 'role_play') {
      need(typeof sp.ideal_answer === 'string' && wc(sp.ideal_answer) >= 30, 'role_play needs an ideal_answer of 30+ words')
      need(Array.isArray(sp.must_include) && sp.must_include.length >= 1, 'role_play needs must_include points')
    }
    need(/^[\x20-\x7E\n]+$/.test([sp.text, ...(sp.audio?.lines || []).map((l) => l.text)].filter(Boolean).join(' ') || 'x'), 'English item text must use plain keyboard characters')
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
    const w = it.writing
    if (w) {
      content = { min_words: w.min_words, max_words: w.max_words }
      rubric = {
        dimensions: w.dimensions.map((d) => ({ name: d.name, weight: d.weight, anchors: { low: d.low, high: d.high } })),
        must_include: w.must_include || [],
        must_avoid: w.must_avoid || [],
      }
      reference = w.ideal_answer
    } else {
      rubric = { dimensions: it.dimensions || [] }
      reference = it.reference_answer || it.explanation || null
    }
  } else if (it.type === 'listening') {
    // The script stays on the server: the browser only ever gets the audio.
    content = { choices: it.choices, plays: it.plays || 2 }
    rubric = { answer: it.answer, audio: it.audio }
  } else if (it.type === 'speaking') {
    const sp = it.speaking
    content = {
      mode: sp.mode,
      text: sp.mode === 'read_aloud' ? sp.text : undefined,
      has_prompt_audio: sp.mode !== 'read_aloud',
      plays: sp.mode === 'repeat' ? 1 : 2,
      prep_seconds: sp.prep_seconds || 0,
      max_seconds: sp.max_seconds,
    }
    rubric = { mode: sp.mode, text: sp.text, audio: sp.audio, acceptable: sp.acceptable, ideal_answer: sp.ideal_answer, must_include: sp.must_include, cefr: it.cefr }
    reference = sp.ideal_answer || sp.text || null
  } else if (it.type === 'typing') {
    content = { passage: it.typing.passage, seconds: it.typing.seconds }
    rubric = {}
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
