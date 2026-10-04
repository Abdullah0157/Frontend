// Written assessment blueprints: which sections a test has, how many items,
// how long, and how much each section counts. Source of truth for the numbers
// is frameworks/swe-assessment-design.md section 5. Pure module (no I/O) so it
// can be unit-tested with plain node.
//
// A blueprint is turned into a FORM when a session starts: the concrete items
// drawn for this candidate, in order, with their option shuffles. The form is
// frozen on the session so the test cannot change under the candidate and so
// the server can check that every answer belongs to the item actually shown.

export const BLUEPRINT_VERSION = 'swe-written-v1'

export const TRACKS = Object.freeze({
  backend:   { label: 'Backend',             available: true },
  frontend:  { label: 'Frontend',            available: false },
  fullstack: { label: 'Full stack',          available: false },
  mobile:    { label: 'Mobile',              available: false },
  qa:        { label: 'QA / Test automation', available: false },
  devops:    { label: 'DevOps / Cloud',      available: false },
})

export const LEVELS = Object.freeze({
  L2: { label: 'Junior' },
  L3: { label: 'Mid' },
  L4: { label: 'Senior' },
  L5: { label: 'Lead' },
})

// Languages a candidate may code in. TypeScript runs through the JavaScript
// sandbox after its types are stripped, so it shares the JavaScript items.
export const LANGUAGES = Object.freeze({
  javascript: { label: 'JavaScript', itemLanguage: 'javascript' },
  typescript: { label: 'TypeScript', itemLanguage: 'javascript' },
  python:     { label: 'Python',     itemLanguage: 'python' },
})

export const SECTION_LABELS = Object.freeze({
  knowledge: 'Core knowledge',
  coding: 'Coding task',
  review: 'Code review and debugging',
  judgement: 'Engineering judgement',
  reasoning: 'Reasoning',
})

// parts: how a section's items are drawn. `formats` limits knowledge items by
// format; `candidateLanguage` means "only items written in the candidate's
// language" (code_output questions).
const KNOWLEDGE = (count, codeOutput) => [
  { types: ['mcq', 'multi_select'], formats: ['concept', 'find_bug'], count: count - codeOutput },
  { types: ['mcq'], formats: ['code_output'], candidateLanguage: true, count: codeOutput },
]

const PLANS = {
  L2: [
    { key: 'knowledge', minutes: 12, weight: 25, parts: KNOWLEDGE(15, 2) },
    { key: 'coding',    minutes: 25, weight: 40, parts: [{ types: ['coding'], count: 2 }] },
    { key: 'review',    minutes: 6,  weight: 10, parts: [{ types: ['code_review'], count: 1 }] },
    { key: 'judgement', minutes: 6,  weight: 10, parts: [{ types: ['sjt'], count: 5 }] },
    { key: 'reasoning', minutes: 10, weight: 15, parts: [{ types: ['mcq'], count: 10 }], optional: true },
  ],
  L3: [
    { key: 'knowledge', minutes: 15, weight: 25, parts: KNOWLEDGE(20, 3) },
    { key: 'coding',    minutes: 25, weight: 40, parts: [{ types: ['coding'], count: 1 }] },
    { key: 'review',    minutes: 8,  weight: 15, parts: [{ types: ['code_review'], count: 1 }] },
    { key: 'judgement', minutes: 7,  weight: 20, parts: [{ types: ['sjt'], count: 6 }] },
  ],
  L4: [
    { key: 'knowledge', minutes: 10, weight: 15, parts: KNOWLEDGE(12, 2) },
    { key: 'coding',    minutes: 20, weight: 30, parts: [{ types: ['coding'], count: 1 }] },
    { key: 'review',    minutes: 10, weight: 20, parts: [{ types: ['code_review'], count: 1 }] },
    { key: 'judgement', minutes: 15, weight: 35, parts: [
      { types: ['sjt'], count: 4 },
      { types: ['scenario_response'], count: 1 },
    ] },
  ],
  L5: [
    { key: 'knowledge', minutes: 6,  weight: 10, parts: KNOWLEDGE(8, 1) },
    // A lead's work sample is reviewing a junior's pull request and writing the feedback.
    { key: 'coding',    minutes: 15, weight: 25, label: 'Pull request review',
      parts: [{ types: ['code_review'], formats: ['pr_feedback'], count: 1 }] },
    { key: 'review',    minutes: 10, weight: 20, label: 'Incident from logs',
      parts: [{ types: ['code_review'], formats: ['incident'], count: 1 }] },
    { key: 'judgement', minutes: 15, weight: 45, parts: [
      { types: ['sjt'], count: 6 },
      { types: ['scenario_response'], count: 1 },
    ] },
  ],
}

// Grace period on every section deadline, for network delay and auto-submit.
export const SECTION_GRACE_S = 20

// Build the blueprint for a track + level. Optional sections can be switched
// off by the company (opts.disabledSections); the remaining weights are
// rescaled so they still add up to 100.
export function getBlueprint({ track, level, disabledSections = [] }) {
  if (!TRACKS[track]) throw new Error(`unknown track: ${track}`)
  if (!PLANS[level]) throw new Error(`unknown level: ${level}`)
  const sections = PLANS[level]
    .filter((s) => !(s.optional && disabledSections.includes(s.key)))
    .map((s) => ({ ...s, label: s.label || SECTION_LABELS[s.key], parts: s.parts.map((p) => ({ ...p })) }))
  const total = sections.reduce((a, s) => a + s.weight, 0)
  for (const s of sections) s.weight = Number(((s.weight * 100) / total).toFixed(2))
  return {
    version: BLUEPRINT_VERSION,
    family: 'swe',
    track,
    level,
    sections,
    totalMinutes: sections.reduce((a, s) => a + s.minutes, 0),
  }
}

// Legacy role_family codes ('swe-backend') used by jobs and the old flow.
export function roleFamilyFor(track) {
  return `swe-${track}`
}
export function trackFromRoleFamily(roleFamily) {
  const m = /^swe-([a-z]+)$/.exec(String(roleFamily || ''))
  return m && TRACKS[m[1]] ? m[1] : null
}

// ── Random draw ───────────────────────────────────────────────────────────

// Small seeded PRNG (mulberry32) so a form can be reproduced from its seed in
// tests and audits.
export function seededRandom(seed) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function shuffled(arr, rand) {
  const a = arr.slice()
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function itemMatchesPart(item, part, { track, level, itemLanguage }) {
  if (!(item.tracks || []).includes(track)) return false
  if (!(item.levels || []).includes(level)) return false
  if (!part.types.includes(item.type)) return false
  if (part.formats && !part.formats.includes(item.format || 'concept')) return false
  if (part.candidateLanguage) return item.language === itemLanguage
  // Language-specific items only go to candidates who chose that language.
  return item.language == null || item.language === itemLanguage
}

// Pick `count` items, spreading them across skills (content balancing): items
// are taken round-robin from per-skill queues, so one topic cannot fill a
// section by chance.
function balancedPick(candidates, count, rand) {
  const bySkill = new Map()
  for (const it of shuffled(candidates, rand)) {
    const k = it.primary_skill_code || 'none'
    if (!bySkill.has(k)) bySkill.set(k, [])
    bySkill.get(k).push(it)
  }
  const queues = shuffled([...bySkill.values()], rand)
  const picked = []
  while (picked.length < count && queues.some((q) => q.length > 0)) {
    for (const q of queues) {
      if (picked.length >= count) break
      if (q.length > 0) picked.push(q.shift())
    }
  }
  return picked
}

const CHOICE_TYPES = new Set(['mcq', 'multi_select', 'sjt'])

// Draw a form from the live bank. `bank` is an array of item rows (id, type,
// format, language, tracks, levels, primary_skill_code, content). Returns the
// form plus any shortfall (a part that had fewer items than planned).
export function drawForm(blueprint, bank, { language, seed }) {
  const lang = LANGUAGES[language]
  if (!lang) throw new Error(`unknown language: ${language}`)
  const rand = seededRandom(seed)
  const used = new Set()
  // Near-duplicate items share a `group:<name>` tag; at most one per form.
  const groupOf = (it) => (it.tags || []).find((t) => t.startsWith('group:')) || null
  const usedGroups = new Set()
  const shortfall = []
  const sections = blueprint.sections.map((section) => {
    const items = []
    for (const part of section.parts) {
      const pool = bank.filter((it) => !used.has(it.id) && !usedGroups.has(groupOf(it)) && itemMatchesPart(it, part, {
        track: blueprint.track, level: blueprint.level, itemLanguage: lang.itemLanguage,
      }))
      const picked = []
      for (const it of balancedPick(pool, pool.length, rand)) {
        if (picked.length >= part.count) break
        const g = groupOf(it)
        if (g && usedGroups.has(g)) continue
        if (g) usedGroups.add(g)
        picked.push(it)
      }
      if (picked.length < part.count) {
        shortfall.push({ section: section.key, types: part.types, wanted: part.count, got: picked.length })
      }
      for (const it of picked) {
        used.add(it.id)
        const entry = { itemId: it.id, type: it.type }
        // Options are shown in a per-candidate order; `order[k]` is the
        // original index of the option shown in position k.
        const n = it.content?.choices?.length || 0
        if (CHOICE_TYPES.has(it.type) && n > 0) {
          entry.order = shuffled([...Array(n).keys()], rand)
        }
        items.push(entry)
      }
    }
    return {
      key: section.key,
      label: section.label,
      minutes: section.minutes,
      weight: section.weight,
      items: shuffled(items, rand),
    }
  })
  return { seed, language, sections, shortfall }
}

// A form is usable only if every section has at least one item.
export function formIsUsable(form) {
  return form.sections.length > 0 && form.sections.every((s) => s.items.length > 0)
}

// ── Bands ─────────────────────────────────────────────────────────────────

export const BANDS = Object.freeze([
  { min: 80, key: 'strong', label: 'Strong', recommendation: 'strong_yes' },
  { min: 65, key: 'good', label: 'Good', recommendation: 'yes' },
  { min: 50, key: 'borderline', label: 'Borderline', recommendation: 'maybe' },
  { min: -Infinity, key: 'not_yet', label: 'Not yet', recommendation: 'no' },
])

export function bandFor(score100) {
  if (score100 == null || !Number.isFinite(score100)) return null
  return BANDS.find((b) => score100 >= b.min)
}

// ── Job link ──────────────────────────────────────────────────────────────

// Suggest the written test for a job from its title and description. Simple,
// explainable keyword rules: the company always confirms or edits the result.
const TRACK_RULES = [
  ['mobile', /\b(ios|android|flutter|react native|swift|kotlin|mobile)\b/i],
  ['qa', /\b(qa|quality assurance|sdet|test automation|tester)\b/i],
  ['devops', /\b(devops|sre|site reliability|kubernetes|terraform|cloud engineer|platform engineer)\b/i],
  ['fullstack', /\b(full[ -]?stack|mern|mean stack)\b/i],
  ['frontend', /\b(front[ -]?end|react|vue|angular|ui engineer|next\.js)\b/i],
  ['backend', /\b(back[ -]?end|api|node|django|flask|fastapi|spring|server|microservice)/i],
]
const LEVEL_RULES = [
  ['L5', /\b(lead|staff|principal|architect|head of|engineering manager)\b/i],
  ['L4', /\b(senior|sr\.?)\b/i],
  ['L2', /\b(junior|jr\.?|intern|graduate|entry[- ]level|trainee)\b/i],
]

export function suggestAssessment({ title = '', role = '', description = '' }) {
  const head = `${title} ${role}`
  const all = `${head} ${description}`
  const reasons = []
  let track = 'backend'
  const trackHit = TRACK_RULES.find(([, re]) => re.test(head)) || TRACK_RULES.find(([, re]) => re.test(all))
  if (trackHit) {
    track = trackHit[0]
    reasons.push(`"${(head.match(trackHit[1]) || all.match(trackHit[1]))[0]}" points to ${TRACKS[track].label}`)
  }
  let level = 'L3'
  const levelHit = LEVEL_RULES.find(([, re]) => re.test(head))
  if (levelHit) {
    level = levelHit[0]
    reasons.push(`"${head.match(levelHit[1])[0]}" in the title points to ${LEVELS[level].label}`)
  } else {
    const years = all.match(/(\d+)\s*\+?\s*(?:years|yrs)/i)
    if (years) {
      const y = Number(years[1])
      level = y >= 8 ? 'L5' : y >= 5 ? 'L4' : y >= 2 ? 'L3' : 'L2'
      reasons.push(`${y}+ years asked for points to ${LEVELS[level].label}`)
    } else {
      reasons.push('no seniority words found, so Mid is suggested')
    }
  }
  const languages = []
  if (/\bpython|django|flask|fastapi\b/i.test(all)) languages.push('python')
  if (/\btypescript\b|\bts\b/i.test(all)) languages.push('typescript')
  if (/\bjavascript|node(\.js)?\b|express|react|vue|angular|next\.js/i.test(all)) languages.push('javascript')
  if (languages.length === 0) {
    languages.push('javascript', 'typescript', 'python')
    reasons.push('no language named, so all are allowed')
  } else if (languages.includes('typescript') && !languages.includes('javascript')) {
    languages.push('javascript')
  }
  if (!TRACKS[track].available) {
    reasons.push(`the ${TRACKS[track].label} test is not ready yet; Backend is used until it is`)
    track = 'backend'
  }
  return { track, level, languages, disabledSections: [], reasons }
}

// Validate a company's choice before storing it on the job.
export function normaliseAssessmentConfig(input) {
  if (!input || input.enabled === false) return null
  const track = TRACKS[input.track]?.available ? input.track : null
  if (!track) throw new Error('choose an available assessment track')
  if (!LEVELS[input.level]) throw new Error('choose a level')
  const languages = [...new Set((input.languages || []).filter((l) => LANGUAGES[l]))]
  if (languages.length === 0) throw new Error('allow at least one coding language')
  const disabledSections = (input.disabledSections || []).filter((k) => k === 'reasoning')
  return { track, level: input.level, languages, disabledSections, version: BLUEPRINT_VERSION }
}
