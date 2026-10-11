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
export const blueprintVersion = (family) => `${family}-written-v1`

// The 22 job families. `ready` families have question banks; any job in a
// family that is not ready yet gets the General workplace assessment until it
// is (frameworks/assessment-coverage-design.md).
export const FAMILIES = Object.freeze({
  swe: { label: 'Software engineering', ready: true },
  data: { label: 'Data and AI', ready: false },
  it_support: { label: 'IT support and cybersecurity', ready: false },
  product: { label: 'Product and project management', ready: false },
  design: { label: 'Design', ready: false },
  sales: { label: 'Sales and business development', ready: false },
  customer_service: { label: 'Customer service and call centre', ready: true },
  marketing: { label: 'Marketing and content', ready: false },
  finance: { label: 'Finance and accounting', ready: false },
  hr: { label: 'HR and recruitment', ready: false },
  admin: { label: 'Administration and virtual assistant', ready: false },
  operations: { label: 'Operations and supply chain', ready: false },
  management: { label: 'Management and leadership', ready: false },
  healthcare: { label: 'Healthcare', ready: false },
  education: { label: 'Education and training', ready: false },
  legal: { label: 'Legal and compliance', ready: false },
  engineering: { label: 'Engineering (non-software)', ready: false },
  trades: { label: 'Skilled trades', ready: false },
  hospitality: { label: 'Hospitality and retail', ready: false },
  manufacturing: { label: 'Manufacturing', ready: false },
  writing: { label: 'Writing and translation', ready: false },
  finance_services: { label: 'Banking, insurance and real estate', ready: false },
  general: { label: 'General workplace', ready: true },
  english: { label: 'English language', ready: true },
})

// `languages`: the coding languages a candidate may choose (empty = no coding).
// Frontend work is JavaScript/TypeScript; backend and full stack also allow Python.
const ALL_LANGS = ['javascript', 'typescript', 'python']
const SWE_LEVELS = ['L2', 'L3', 'L4', 'L5']
export const TRACKS = Object.freeze({
  backend:   { family: 'swe', label: 'Backend',              available: true,  languages: ALL_LANGS, levels: SWE_LEVELS },
  frontend:  { family: 'swe', label: 'Frontend',             available: true,  languages: ['javascript', 'typescript'], levels: SWE_LEVELS },
  fullstack: { family: 'swe', label: 'Full stack',           available: true,  languages: ALL_LANGS, levels: SWE_LEVELS },
  mobile:    { family: 'swe', label: 'Mobile',               available: false, languages: ALL_LANGS, levels: SWE_LEVELS },
  qa:        { family: 'swe', label: 'QA / Test automation', available: false, languages: ALL_LANGS, levels: SWE_LEVELS },
  devops:    { family: 'swe', label: 'DevOps / Cloud',       available: false, languages: ALL_LANGS, levels: SWE_LEVELS },
  general:   { family: 'general', label: 'General workplace', available: true, languages: [], levels: ['staff', 'manager'] },
  customer_service: { family: 'customer_service', label: 'Customer service', available: true, languages: [], levels: ['agent'] },
  english:     { family: 'english', label: 'English test', available: true, languages: [], levels: ['screener'] },
  telesales:   { family: 'customer_service', label: 'Telesales', available: false, languages: [], levels: ['agent'] },
  collections: { family: 'customer_service', label: 'Collections', available: false, languages: [], levels: ['agent'] },
})

export const LEVELS = Object.freeze({
  L2: { label: 'Junior' },
  L3: { label: 'Mid' },
  L4: { label: 'Senior' },
  L5: { label: 'Lead' },
  staff: { label: 'Staff' },
  manager: { label: 'Manager' },
  agent: { label: 'Agent' },
  screener: { label: 'Screener' },
  full: { label: 'Full' },
})

export const CEFR_LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2']

// Languages a candidate may code in. TypeScript runs through the JavaScript
// sandbox after its types are stripped, so it shares the JavaScript items.
export const LANGUAGES = Object.freeze({
  javascript: { label: 'JavaScript', itemLanguage: 'javascript' },
  typescript: { label: 'TypeScript', itemLanguage: 'javascript' },
  python:     { label: 'Python',     itemLanguage: 'python' },
})

// Typing pass marks by role (design decision 3); a job may override them.
export const TYPING_PROFILES = Object.freeze({
  voice: { label: 'Voice agents', netWpm: 25, accuracy: 92 },
  chat: { label: 'Chat and email agents', netWpm: 35, accuracy: 95 },
})

export const SECTION_LABELS = Object.freeze({
  knowledge: 'Core knowledge',
  coding: 'Coding task',
  review: 'Code review and debugging',
  judgement: 'Engineering judgement',
  reasoning: 'Reasoning',
  workplace_judgement: 'Workplace judgement',
  written_communication: 'Written communication',
  numbers: 'Numbers at work',
  detail: 'Attention to detail',
  instructions: 'Following instructions',
  typing: 'Typing',
  customer_situations: 'Customer situations',
  written_reply: 'Written reply to a customer',
  accuracy: 'Accuracy and numbers',
  listening: 'Listening',
  read_aloud: 'Read aloud',
  repeat: 'Listen and repeat',
  short_answers: 'Short spoken answers',
  role_play: 'Customer role-play',
  reading: 'Reading',
})

// parts: how a section's items are drawn. `formats` limits knowledge items by
// format; `candidateLanguage` means "only items written in the candidate's
// language" (code_output questions).
const KNOWLEDGE = (count, codeOutput) => [
  { types: ['mcq', 'multi_select'], formats: ['concept', 'find_bug'], count: count - codeOutput },
  { types: ['mcq'], formats: ['code_output'], candidateLanguage: true, count: codeOutput },
]

const SWE_PLANS = {
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

// General workplace (any job). Manager weights judgement higher.
const GENERAL_PLANS = {
  staff: [
    { key: 'workplace_judgement',   minutes: 8, weight: 30, parts: [{ types: ['sjt'], count: 8 }] },
    { key: 'written_communication', minutes: 8, weight: 25, parts: [{ types: ['scenario_response'], count: 1 }] },
    { key: 'numbers',               minutes: 7, weight: 20, parts: [{ types: ['mcq', 'multi_select'], count: 8 }] },
    { key: 'detail',                minutes: 5, weight: 15, parts: [{ types: ['mcq', 'multi_select'], count: 8 }] },
    { key: 'instructions',          minutes: 4, weight: 10, parts: [{ types: ['mcq', 'multi_select'], count: 4 }] },
  ],
  manager: [
    { key: 'workplace_judgement',   minutes: 8, weight: 40, parts: [{ types: ['sjt'], count: 8 }] },
    { key: 'written_communication', minutes: 8, weight: 25, parts: [{ types: ['scenario_response'], count: 1 }] },
    { key: 'numbers',               minutes: 7, weight: 15, parts: [{ types: ['mcq', 'multi_select'], count: 8 }] },
    { key: 'detail',                minutes: 5, weight: 10, parts: [{ types: ['mcq', 'multi_select'], count: 8 }] },
    { key: 'instructions',          minutes: 4, weight: 10, parts: [{ types: ['mcq', 'multi_select'], count: 4 }] },
  ],
}

// Customer service, Agent. Chat and email roles weight typing higher.
const CS_PLANS = {
  agent: [
    { key: 'typing',              minutes: 3, weight: 15, parts: [{ types: ['typing'], count: 1 }] },
    { key: 'customer_situations', minutes: 8, weight: 30, parts: [{ types: ['sjt'], count: 8 }] },
    { key: 'written_reply',       minutes: 6, weight: 25, parts: [{ types: ['scenario_response'], count: 1 }] },
    { key: 'accuracy',            minutes: 5, weight: 30, parts: [{ types: ['mcq', 'multi_select'], count: 8 }] },
  ],
}

// English Screener (frameworks/english-assessment-design.md section 4).
const ENGLISH_PLANS = {
  screener: [
    { key: 'listening',     minutes: 5, weight: 30, parts: [{ types: ['listening'], count: 6 }] },
    { key: 'read_aloud',    minutes: 2, weight: 10, parts: [{ types: ['speaking'], count: 2 }] },
    { key: 'repeat',        minutes: 2, weight: 15, parts: [{ types: ['speaking'], count: 4 }] },
    { key: 'short_answers', minutes: 2, weight: 10, parts: [{ types: ['speaking'], count: 3 }] },
    { key: 'role_play',     minutes: 3, weight: 20, parts: [{ types: ['speaking'], count: 1 }] },
    { key: 'reading',       minutes: 3, weight: 15, parts: [{ types: ['mcq'], count: 6 }] },
  ],
}

const PLANS_BY_FAMILY = { swe: SWE_PLANS, general: GENERAL_PLANS, customer_service: CS_PLANS, english: ENGLISH_PLANS }

// Grace period on every section deadline, for network delay and auto-submit.
export const SECTION_GRACE_S = 20

// Build the blueprint for a track + level. Optional sections can be switched
// off by the company (opts.disabledSections); the remaining weights are
// rescaled so they still add up to 100.
export function getBlueprint({ track, level, disabledSections = [], options = {} }) {
  if (!TRACKS[track]) throw new Error(`unknown track: ${track}`)
  const family = TRACKS[track].family
  const plan = PLANS_BY_FAMILY[family]?.[level]
  if (!plan || !TRACKS[track].levels.includes(level)) throw new Error(`unknown level for ${track}: ${level}`)
  const sections = plan
    .filter((s) => !(s.optional && disabledSections.includes(s.key)))
    .map((s) => ({ ...s, label: s.label || SECTION_LABELS[s.key], parts: s.parts.map((p) => ({ ...p })) }))
  if (track === 'fullstack') {
    // Explicit mix of concept questions: about 15% written for full stack
    // (auth across client and server, CORS, SSR...), the rest split evenly
    // between the backend and frontend sides (e.g. Mid: 3 + 7 + 7).
    for (const s of sections.filter((x) => x.key === 'knowledge')) {
      const concept = s.parts.find((p) => p.formats?.includes('concept'))
      const cross = Math.max(1, Math.round(concept.count * 0.15))
      const half = Math.ceil((concept.count - cross) / 2)
      s.parts.splice(s.parts.indexOf(concept), 1,
        { ...concept, fullstackOnly: true, count: cross },
        { ...concept, fromTrack: 'backend', fullstackOnly: false, count: half },
        { ...concept, fromTrack: 'frontend', fullstackOnly: false, count: concept.count - cross - half })
    }
  }
  // Customer service: chat and email roles weight typing higher (25%, taken
  // from accuracy), and carry the typing pass marks for scoring.
  let typing = null
  if (family === 'customer_service') {
    const profile = TYPING_PROFILES[options.typingProfile] ? options.typingProfile : 'voice'
    typing = {
      profile,
      netWpm: clampNum(options.typingNetWpm, 10, 90) ?? TYPING_PROFILES[profile].netWpm,
      accuracy: clampNum(options.typingAccuracy, 70, 100) ?? TYPING_PROFILES[profile].accuracy,
    }
    if (profile === 'chat') {
      sections.find((x) => x.key === 'typing').weight = 25
      sections.find((x) => x.key === 'accuracy').weight = 20
    }
  }
  // English: the level the job requires (default B2, the usual floor for voice agents).
  const english = family === 'english'
    ? { requiredLevel: CEFR_LEVELS.includes(options.requiredLevel) ? options.requiredLevel : 'B2' }
    : null
  const total = sections.reduce((a, s) => a + s.weight, 0)
  for (const s of sections) s.weight = Number(((s.weight * 100) / total).toFixed(2))
  return {
    version: family === 'swe' ? BLUEPRINT_VERSION : blueprintVersion(family),
    family,
    track,
    level,
    sections,
    options: typing ? { typing } : english ? { english } : {},
    usesCode: TRACKS[track].languages.length > 0,
    totalMinutes: sections.reduce((a, s) => a + s.minutes, 0),
  }
}

function clampNum(v, lo, hi) {
  const n = Number(v)
  return Number.isFinite(n) && n >= lo && n <= hi ? n : null
}

// role_family codes stored on sessions and in jobs' required_assessments:
// software tracks keep 'swe-backend'; other tracks use the track key itself.
export function roleFamilyFor(track) {
  return TRACKS[track]?.family === 'swe' ? `swe-${track}` : track
}
export function trackFromRoleFamily(roleFamily) {
  const code = String(roleFamily || '')
  const m = /^swe-([a-z]+)$/.exec(code)
  if (m) return TRACKS[m[1]] ? m[1] : null
  return TRACKS[code] && TRACKS[code].family !== 'swe' ? code : null
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

// Languages a coding or code-review item is written in (from its content).
function itemLanguages(item) {
  const c = item.content || {}
  if (item.type === 'coding') return Object.keys(c.function_name || {})
  if (item.type === 'code_review') return Object.keys(c.code_by_language || {})
  return null
}

function itemMatchesPart(item, part, { track, level, itemLanguage }) {
  const tracks = item.tracks || []
  if (!tracks.includes(track)) return false
  if (!(item.levels || []).includes(level)) return false
  if (!part.types.includes(item.type)) return false
  if (part.formats && !part.formats.includes(item.format || 'concept')) return false
  // Full stack draws half its knowledge from each side; items written only
  // for full stack count for either side.
  const fullstackOnly = tracks.length === 1 && tracks[0] === 'fullstack'
  if (part.fromTrack && !tracks.includes(part.fromTrack)) return false
  if (part.fullstackOnly !== undefined && part.fullstackOnly !== fullstackOnly) return false
  const langs = itemLanguages(item)
  if (langs && !langs.includes(itemLanguage)) return false
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

const CHOICE_TYPES = new Set(['mcq', 'multi_select', 'sjt', 'listening'])

// Draw a form from the live bank. `bank` is an array of item rows (id, type,
// format, language, tracks, levels, primary_skill_code, content). Returns the
// form plus any shortfall (a part that had fewer items than planned).
export function drawForm(blueprint, bank, { language, seed }) {
  // Tests without code have no candidate language: only language-neutral items.
  const lang = blueprint.usesCode === false ? { itemLanguage: null } : LANGUAGES[language]
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
  return { seed, language: blueprint.usesCode === false ? null : language, sections, shortfall, options: blueprint.options || {} }
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

// Suggest the test for a job from its title and description. Simple,
// explainable keyword rules; the company always confirms or edits the result.
// Order matters: the first family whose words appear in the TITLE wins, then
// the description is tried.
const FAMILY_RULES = [
  ['swe', /\b(software|developer|programmer|tech(nical)? lead|software architect|engineering manager|api|typescript|javascript|golang|java|php|\.net|full[ -]?stack|front[ -]?end|back[ -]?end|web developer|mobile developer|ios|android|flutter|react|node(\.js)?|django|devops|sre|qa engineer|sdet|test automation)\b/i],
  ['customer_service', /\b(customer (service|support|care|success)|support (agent|representative|specialist)|call (centre|center)|contact (centre|center)|csr|chat (agent|support)|helpline|bpo agent|telesales|collections? agent)\b/i],
  ['data', /\b(data (analyst|scientist|engineer)|machine learning|ml engineer|business intelligence|bi analyst|analytics)\b/i],
  ['it_support', /\b(it support|help ?desk|network (admin|engineer)|system administrator|sysadmin|security analyst|cyber ?security|soc analyst)\b/i],
  ['product', /\b(product (manager|owner)|project (manager|coordinator)|scrum master|program manager)\b/i],
  ['design', /\b(designer|ui\/ux|ux|ui designer|graphic design)\b/i],
  ['sales', /\b(sales|account (executive|manager)|business development|sdr|bdr|lead generation)\b/i],
  ['marketing', /\b(marketing|seo|social media|content (manager|strategist)|growth|brand)\b/i],
  ['finance', /\b(accountant|accounting|bookkeep|finance|financial analyst|auditor|payroll|tax)\b/i],
  ['hr', /\b(recruiter|recruitment|talent acquisition|hr |human resources|people partner)\b/i],
  ['admin', /\b(admin(istrator|istrative)?|assistant|virtual assistant|receptionist|data entry|office (manager|coordinator)|secretary)\b/i],
  ['operations', /\b(operations|logistics|supply chain|warehouse|procurement|dispatcher|inventory)\b/i],
  ['healthcare', /\b(nurse|nursing|medical|clinic(al)?|pharmac|care ?giver|doctor|dental|patient)\b/i],
  ['education', /\b(teacher|tutor|lecturer|trainer|instructor|teaching)\b/i],
  ['legal', /\b(legal|lawyer|paralegal|attorney|compliance officer|solicitor)\b/i],
  ['engineering', /\b(civil|mechanical|electrical|structural|chemical) engineer\b/i],
  ['trades', /\b(electrician|plumber|mechanic|technician|welder|carpenter|hvac)\b/i],
  ['hospitality', /\b(retail|cashier|store|shop|hotel|restaurant|barista|waiter|waitress|chef|cook|front desk|housekeep)\b/i],
  ['manufacturing', /\b(machine operator|production (operator|worker)|assembly|quality inspector|factory)\b/i],
  ['writing', /\b(writer|copywriter|editor|translator|journalist|proofreader)\b/i],
  ['finance_services', /\b(bank(ing)?|teller|loan officer|insurance|underwriter|real estate|mortgage)\b/i],
]
const SWE_TRACK_RULES = [
  ['mobile', /\b(ios|android|flutter|react native|swift|kotlin|mobile)\b/i],
  ['qa', /\b(qa|quality assurance|sdet|test automation|tester)\b/i],
  ['devops', /\b(devops|sre|site reliability|kubernetes|terraform|cloud engineer|platform engineer)\b/i],
  ['fullstack', /\b(full[ -]?stack|mern|mean stack)\b/i],
  ['frontend', /\b(front[ -]?end|react|vue|angular|ui engineer|next\.js)\b/i],
  ['backend', /\b(back[ -]?end|api|node|django|flask|fastapi|spring|server|microservice)/i],
]
const SWE_LEVEL_RULES = [
  ['L5', /\b(lead|staff|principal|architect|head of|engineering manager)\b/i],
  ['L4', /\b(senior|sr\.?)\b/i],
  ['L2', /\b(junior|jr\.?|intern|graduate|entry[- ]level|trainee)\b/i],
]
const MANAGER_WORDS = /\b(manager|supervisor|team lead(er)?|head of|director|lead)\b/i
const CHAT_WORDS = /\b(chat|email|e-mail|live chat|messaging|written support|non[- ]voice|ticket)\b/i

function firstHit(rules, head, all) {
  return rules.find(([, re]) => re.test(head)) || rules.find(([, re]) => re.test(all))
}

export function suggestAssessment({ title = '', role = '', description = '' }) {
  const head = `${title} ${role}`
  const all = `${head} ${description}`
  const reasons = []
  const famHit = firstHit(FAMILY_RULES, head, all)
  const family = famHit ? famHit[0] : null
  if (famHit) reasons.push(`"${(head.match(famHit[1]) || all.match(famHit[1]))[0]}" points to ${FAMILIES[family].label}`)

  if (family === 'swe') return { family, ...suggestSwe(head, all, reasons) }

  if (family === 'customer_service') {
    const chat = CHAT_WORDS.test(all)
    reasons.push(chat ? 'chat or email work found, so typing counts more' : 'phone work assumed, so voice typing marks are used')
    reasons.push(`customer work in English, so the English Screener is added at ${chat ? 'B1' : 'B2'}`)
    return { family, track: 'customer_service', level: 'agent', languages: [], disabledSections: [],
      options: { typingProfile: chat ? 'chat' : 'voice' }, english: { requiredLevel: chat ? 'B1' : 'B2' }, reasons }
  }

  // Not built yet (or not recognised): the General workplace test, Staff or Manager.
  const level = MANAGER_WORDS.test(head) ? 'manager' : 'staff'
  const note = family
    ? `A ${FAMILIES[family].label} test is coming. The General workplace test is used until then.`
    : 'No specific industry was recognised, so the General workplace test is suggested.'
  reasons.push(level === 'manager' ? 'manager or supervisor role, so the Manager version' : 'staff role, so the Staff version')
  return { family: 'general', recognisedFamily: family, track: 'general', level, languages: [], disabledSections: [], options: {}, reasons, note }
}

function suggestSwe(head, all, reasons) {
  let track = 'backend'
  const trackHit = firstHit(SWE_TRACK_RULES, head, all)
  if (trackHit) {
    track = trackHit[0]
    reasons.push(`"${(head.match(trackHit[1]) || all.match(trackHit[1]))[0]}" points to ${TRACKS[track].label}`)
  }
  let level = 'L3'
  const levelHit = SWE_LEVEL_RULES.find(([, re]) => re.test(head))
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
  let allowed = languages.filter((l) => TRACKS[track].languages.includes(l))
  if (allowed.length === 0) {
    allowed = [...TRACKS[track].languages]
    reasons.push(`${TRACKS[track].label} is coded in ${allowed.join(' or ')}`)
  }
  return { track, level, languages: allowed, disabledSections: [], options: {}, reasons }
}

// Validate a company's choice before storing it on the job.
export function normaliseAssessmentConfig(input) {
  if (!input || input.enabled === false) return null
  const track = TRACKS[input.track]?.available ? input.track : null
  if (!track) throw new Error('choose an available assessment')
  const t = TRACKS[track]
  if (!t.levels.includes(input.level)) throw new Error(`choose a level for ${t.label}: ${t.levels.map((l) => LEVELS[l].label).join(', ')}`)
  let languages = []
  if (t.languages.length) {
    languages = [...new Set((input.languages || []).filter((l) => LANGUAGES[l] && t.languages.includes(l)))]
    if (languages.length === 0) throw new Error(`allow at least one coding language for ${t.label}: ${t.languages.join(', ')}`)
  }
  const disabledSections = (input.disabledSections || []).filter((k) => k === 'reasoning')
  const options = {}
  if (t.family === 'customer_service') {
    const o = input.options || {}
    options.typingProfile = TYPING_PROFILES[o.typingProfile] ? o.typingProfile : 'voice'
    const wpm = clampNum(o.typingNetWpm, 10, 90)
    const acc = clampNum(o.typingAccuracy, 70, 100)
    if (wpm != null) options.typingNetWpm = wpm
    if (acc != null) options.typingAccuracy = acc
  }
  if (t.family === 'english') {
    options.requiredLevel = CEFR_LEVELS.includes(input.options?.requiredLevel) ? input.options.requiredLevel : 'B2'
  }
  // Optional English add-on for a job whose main test is another one.
  const english = t.family !== 'english' && input.english && input.english.enabled !== false
    ? { requiredLevel: CEFR_LEVELS.includes(input.english.requiredLevel) ? input.english.requiredLevel : 'B2' }
    : null
  return { family: t.family, track, level: input.level, languages, disabledSections, options, english, version: t.family === 'swe' ? BLUEPRINT_VERSION : blueprintVersion(t.family) }
}
