// Large-scale rubric-alignment test for Maya (Domain Expert interview).
// Runs 100 FULL interviews for diverse users across many domains and 3 quality
// tiers (WEAK / MEDIUM / STRONG). For each user it runs every question, answers
// them, generates the rubric report, and saves it. Then it prints aggregate
// alignment stats so we can confirm the AI grading is calibrated at scale:
// weak users should score low, strong users high, with clean separation.
//
// Usage:  node scripts/test-100-users.mjs [N]      (default N=100)
//         node scripts/test-100-users.mjs --no-save   (skip DB writes)

import { readFileSync } from 'node:fs'
import pg from 'pg'

// ── env ──────────────────────────────────────────────────────────────────
const env = readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
for (const line of env.split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.+?)\s*$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2]
}

const args = process.argv.slice(2)
const NO_SAVE = args.includes('--no-save')
const N = Number(args.find((a) => /^\d+$/.test(a))) || 100
const CONCURRENCY = 2
const BASE = 'http://localhost:3002/api/interview'

const pool = NO_SAVE ? null : new pg.Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } })

// ── domain families: each has a domain label, focus areas, and context slots ──
const FAMILIES = [
  {
    key: 'eng',
    domains: ['Full Stack Engineering', 'Backend Engineering', 'Platform Engineering', 'DevOps Engineering'],
    focus: ['API design', 'system scalability', 'CI/CD pipelines', 'database performance'],
    ctx: [
      { project: 'an internal payments service', tool: 'FastAPI and Redis', metric: 'p99 latency by 60%', team: 'the backend team' },
      { project: 'a real-time notifications platform', tool: 'Node.js and Kafka', metric: 'throughput 4x', team: 'the platform team' },
      { project: 'a CI/CD migration', tool: 'GitHub Actions and Docker', metric: 'build times by 55%', team: 'the infra team' },
    ],
  },
  {
    key: 'data',
    domains: ['Data Science', 'Machine Learning Engineering', 'AI Engineering', 'Data Engineering'],
    focus: ['model evaluation', 'feature engineering', 'data pipelines', 'LLM integration'],
    ctx: [
      { project: 'a churn prediction model', tool: 'XGBoost and MLflow', metric: 'recall from 0.6 to 0.82', team: 'the data science team' },
      { project: 'an LLM evaluation harness', tool: 'Python and a rubric-based eval', metric: 'false positives by 70%', team: 'the AI team' },
      { project: 'a batch feature pipeline', tool: 'Spark and Airflow', metric: 'processing cost by 40%', team: 'the data platform team' },
    ],
  },
  {
    key: 'pm',
    domains: ['Product Management', 'Growth Product', 'Platform Product', 'B2B SaaS Product'],
    focus: ['product discovery', 'prioritization', 'metrics and experimentation', 'stakeholder alignment'],
    ctx: [
      { project: 'an onboarding redesign', tool: 'a north-star activation metric', metric: 'activation by 22%', team: 'a squad of 6' },
      { project: 'a pricing experiment', tool: 'an A/B testing framework', metric: 'conversion by 15%', team: 'growth and design' },
      { project: 'a self-serve funnel', tool: 'funnel analytics and interviews', metric: 'trial-to-paid by 18%', team: 'the product pod' },
    ],
  },
  {
    key: 'sales',
    domains: ['Enterprise Sales', 'Sales Engineering', 'Account Management', 'Revenue Operations'],
    focus: ['pipeline management', 'discovery calls', 'negotiation', 'forecasting accuracy'],
    ctx: [
      { project: 'an enterprise expansion motion', tool: 'a MEDDIC qualification process', metric: 'quota to 140%', team: 'the enterprise team' },
      { project: 'a new outbound playbook', tool: 'a multi-threaded sequence', metric: 'win rate by 12 points', team: 'the SDR team' },
      { project: 'a forecasting overhaul', tool: 'a weighted-stage model', metric: 'forecast accuracy to 92%', team: 'revenue ops' },
    ],
  },
]

// ── tiered answer generators (quality separated by depth/specificity/ownership) ──
const TIERS = {
  WEAK: (c) => [
    `Uh, yeah, I'm someone who works in ${c.domain.toLowerCase()}. I did some stuff at a company.`,
    `We just followed best practices and it mostly worked out I think.`,
    `I'm not really sure about the details, ${c.team} handled a lot of that.`,
    `It was fine. Nothing really broke that I remember.`,
    `I guess I'm good at figuring things out when I need to.`,
    `Not really, I don't have a specific answer for that one.`,
  ],
  MEDIUM: (c) => [
    `I've worked in ${c.domain.toLowerCase()} for a few years. I helped build ${c.project} at my job.`,
    `I worked on ${c.project} using ${c.tool}. It helped ${c.team} get things done a bit faster.`,
    `We used ${c.tool} for it. I connected the main pieces together so it ran when it needed to.`,
    `Sometimes it didn't work well so we had to adjust it. It took some trial and error to get usable.`,
    `I think I'm decent at the core work and I still have things to learn about scaling it up.`,
    `One thing I learned is that the first version usually needs a lot of iteration before it's reliable.`,
  ],
  STRONG: (c) => [
    `I lead work in ${c.domain.toLowerCase()} and over several years I've shipped it in production. The piece I'm proudest of is ${c.project}, which I owned end to end.`,
    `I designed ${c.project} with ${c.tool}. It moved ${c.metric}, and I drove the whole thing across ${c.team} — from the design through rollout.`,
    `Architecturally it came down to the hard tradeoff: the naive approach was noisy, so I added a confidence threshold and only acted above that bar, which is what made it trustworthy.`,
    `The first version was too aggressive and people pushed back. I re-architected it to rank findings by confidence and impact and only surface the high-value ones — adoption jumped sharply after that.`,
    `I also led a migration with ${c.tool} that cut ${c.metric} under real production load. The tradeoff was operational complexity, so I invested heavily in observability and testing standards, 80%+ coverage.`,
    `Most people underestimate evaluation. Doing the work once is easy; building the harness that scores outputs against task-specific rubrics is what actually makes it reliable, and that's where I spend most of my time.`,
  ],
}
const TIER_ORDER = ['WEAK', 'MEDIUM', 'STRONG']

const FIRST = ['Alex', 'Sam', 'Jordan', 'Taylor', 'Casey', 'Riley', 'Morgan', 'Jamie', 'Avery', 'Quinn', 'Drew', 'Reese', 'Sky', 'Rowan', 'Emerson', 'Hayden', 'Parker', 'Charlie', 'Finley', 'Kai']
const LAST = ['Chen', 'Patel', 'Kim', 'Garcia', 'Okafor', 'Nguyen', 'Silva', 'Haddad', 'Novak', 'Rossi', 'Yamamoto', 'Ahmed', 'Johansson', 'Mbeki', 'Costa', 'Reyes', 'Larsson', 'Diallo', 'Fischer', 'Tan']

// ── build N diverse users ─────────────────────────────────────────────────
function buildUsers(n) {
  const users = []
  for (let i = 0; i < n; i++) {
    const fam = FAMILIES[i % FAMILIES.length]
    const tier = TIER_ORDER[i % 3]
    const domain = fam.domains[Math.floor(i / FAMILIES.length) % fam.domains.length]
    const cbase = fam.ctx[i % fam.ctx.length]
    const c = { ...cbase, domain }
    const name = `${FIRST[i % FIRST.length]} ${LAST[(i * 7) % LAST.length]}`
    users.push({
      i, name, tier, domain, focus: fam.focus,
      answers: TIERS[tier](c),
    })
  }
  return users
}

// ── interview driver ──────────────────────────────────────────────────────
async function fetchWithRetry(body, tries = 6) {
  for (let t = 0; t < tries; t++) {
    try {
      const res = await fetch(BASE, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      if (res.status === 429 || res.status >= 500) { await sleep(2500 * (t + 1)); continue }
      return res
    } catch (e) {
      await sleep(1800 * (t + 1))
    }
  }
  return null
}

async function askQuestion(user, messages, progressRatio) {
  const res = await fetchWithRetry({
    action: 'question', assessmentType: 'domain_expert',
    candidate: { name: user.name, role: user.domain },
    messages, domainExpertise: user.domain, focusAreas: user.focus,
    progressRatio, totalQuestions: 8, sessionId: `t100-${user.i}-${progressRatio}`,
  })
  if (!res) return '(question unavailable)'
  const ct = res.headers.get('content-type') || ''
  if (ct.includes('text/plain')) {
    let out = ''; const reader = res.body.getReader(); const dec = new TextDecoder()
    while (true) { const { done, value } = await reader.read(); if (done) break; out += dec.decode(value, { stream: true }) }
    return out.trim()
  }
  try { return (await res.json()).question } catch { return '(question unavailable)' }
}

async function generateReport(user, messages) {
  // The report call is token-heavy and is the one most likely to hit rate
  // limits, so retry the whole thing until we get a valid scored report.
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await fetchWithRetry({
      action: 'report', assessmentType: 'domain_expert',
      candidate: { name: user.name, role: user.domain },
      messages, domainExpertise: user.domain, sessionId: `t100-report-${user.i}-${attempt}`,
    })
    if (res) {
      try {
        const report = (await res.json()).report
        if (report && Number.isFinite(report.expertise_score)) return report
      } catch { /* fall through to retry */ }
    }
    await sleep(3000 * (attempt + 1))
  }
  return null
}

async function runInterview(user) {
  const messages = []
  const n = user.answers.length
  for (let i = 0; i < n; i++) {
    const q = await askQuestion(user, messages, i / n)
    messages.push({ role: 'assistant', content: q })
    messages.push({ role: 'user', content: user.answers[i] })
    await sleep(400) // gentle pacing to stay under rate limits
  }
  const report = await generateReport(user, messages)
  return { messages, report }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// ── concurrency-limited runner ────────────────────────────────────────────
async function runPool(users, worker) {
  const results = []
  let idx = 0
  let done = 0
  async function next() {
    if (idx >= users.length) return
    const u = users[idx++]
    const r = await worker(u).catch((e) => ({ user: u, error: e.message }))
    results.push(r)
    done++
    if (done % 5 === 0 || done === users.length) process.stdout.write(`\r  progress: ${done}/${users.length} interviews done   `)
    await next()
  }
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, users.length) }, next))
  return results
}

// ── main ──────────────────────────────────────────────────────────────────
async function main() {
  const users = buildUsers(N)
  console.log(`\n▶ Running ${users.length} full Maya interviews (concurrency ${CONCURRENCY}, save=${!NO_SAVE})…\n`)

  const t0 = Date.now()
  const results = await runPool(users, async (user) => {
    const { messages, report } = await runInterview(user)
    if (report && pool) {
      await pool.query(
        `INSERT INTO expert_assessments (candidate_user_id, domain, transcript, report, expertise_score, expertise_level)
         VALUES (NULL, $1, $2::jsonb, $3::jsonb, $4, $5)`,
        [`${user.domain} · T100-${user.tier}-${user.name}`, JSON.stringify(messages), JSON.stringify(report),
         Number.isFinite(report.expertise_score) ? report.expertise_score : null, report.expertise_level || null]
      ).catch(() => {})
    }
    return { user, report }
  })
  const secs = ((Date.now() - t0) / 1000).toFixed(0)

  // ── aggregate ────────────────────────────────────────────────────────────
  const byTier = { WEAK: [], MEDIUM: [], STRONG: [] }
  let noReport = 0
  for (const r of results) {
    if (!r.report || !Number.isFinite(r.report.expertise_score)) { noReport++; continue }
    byTier[r.user.tier].push(r.report.expertise_score)
  }
  const stat = (arr) => {
    if (!arr.length) return { n: 0, mean: NaN, min: NaN, max: NaN }
    const mean = arr.reduce((a, b) => a + b, 0) / arr.length
    return { n: arr.length, mean: +mean.toFixed(2), min: Math.min(...arr), max: Math.max(...arr) }
  }
  const w = stat(byTier.WEAK), m = stat(byTier.MEDIUM), s = stat(byTier.STRONG)

  console.log('\n\n' + '═'.repeat(66))
  console.log(`100-USER RUBRIC ALIGNMENT  ·  ${results.length} interviews in ${secs}s  ·  ${noReport} failed`)
  console.log('═'.repeat(66))
  console.log(`  WEAK   n=${w.n}  mean=${w.mean}  range ${w.min}–${w.max}`)
  console.log(`  MEDIUM n=${m.n}  mean=${m.mean}  range ${m.min}–${m.max}`)
  console.log(`  STRONG n=${s.n}  mean=${s.mean}  range ${s.min}–${s.max}`)

  // misclassification: weak scoring >=6, or strong scoring <=4
  const weakHigh = byTier.WEAK.filter((x) => x >= 6).length
  const strongLow = byTier.STRONG.filter((x) => x <= 4).length
  const medOut = byTier.MEDIUM.filter((x) => x < 3 || x > 9).length

  console.log('\n  Separation checks:')
  console.log(`    mean order weak<medium<strong : ${w.mean < m.mean && m.mean < s.mean ? '✅' : '❌'}  (${w.mean} < ${m.mean} < ${s.mean})`)
  console.log(`    weak users scoring ≥6 (too high): ${weakHigh}/${w.n} ${weakHigh === 0 ? '✅' : '⚠️'}`)
  console.log(`    strong users scoring ≤4 (too low): ${strongLow}/${s.n} ${strongLow === 0 ? '✅' : '⚠️'}`)
  console.log(`    medium users far out of band:      ${medOut}/${m.n} ${medOut === 0 ? '✅' : '⚠️'}`)

  const aligned = w.mean < m.mean && m.mean < s.mean && weakHigh === 0 && strongLow === 0
  console.log('\n' + (aligned ? '✅ RUBRIC ALIGNED AT SCALE — grading separates quality tiers cleanly' : '⚠️ REVIEW — some tiers overlap, see checks above'))

  if (pool) await pool.end()
}

main().catch((e) => { console.error('\nFATAL:', e.message); process.exit(1) })
