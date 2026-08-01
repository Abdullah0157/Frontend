// Clean old synthetic test rows, then run 10 fresh Domain Expert (Maya)
// interviews end-to-end: generate the report + the EIE competency profile
// (evidence, decision, interview-quality) and store each so it shows in the
// admin Expert Rubrics page. Paced + retried for the sandbox's Groq limits.
//
// Run:  node scripts/run-10-maya.mjs

import { readFileSync } from 'node:fs'
import pg from 'pg'

const env = readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
for (const l of env.split('\n')) { const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.+?)\s*$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2] }

const BASE = 'http://localhost:3002'
async function withPool(fn) {
  for (let i = 0; i < 6; i++) {
    const p = new pg.Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } })
    try { const r = await fn(p); await p.end(); return r }
    catch (e) { await p.end().catch(() => {}); if (String(e.message).includes('ENOTFOUND')) { await sleep(3000); continue } throw e }
  }
  throw new Error('db unreachable')
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const MAYA_Q = [
  'Before we dig in, tell me about yourself — who you are and what you do.',
  "What drew you to this field, and what's a project that made you feel you'd truly mastered it?",
  'What kind of problems do you get called in to solve? Walk me through your best work.',
  'Take the hardest version of that — what broke, and how did you figure it out?',
  'Tell me about a time you were wrong, or something you had to unlearn.',
  'What do you know about this domain that most people who claim expertise miss?',
]

const TIERS = {
  WEAK: (c) => [
    `Uh, I work in ${c.d.toLowerCase()}. I've done some things at a company.`,
    `Not sure really — I just kind of fell into it and picked stuff up.`,
    `We followed best practices and it mostly worked. ${c.team} handled a lot of it.`,
    `Nothing really broke that I remember. It was fine.`,
    `I can't think of a specific time. I usually get things right.`,
    `I don't really have a specific answer for that.`,
  ],
  MEDIUM: (c) => [
    `I've worked in ${c.d.toLowerCase()} for a few years. I helped build ${c.proj} at my job.`,
    `I got into it in school and my proudest work is ${c.proj} — it used ${c.tool}.`,
    `I mostly build features and fix issues. ${c.proj} helped ${c.team} move faster after some tuning.`,
    `Sometimes it was slow or buggy, so I adjusted it. Took some trial and error to get it usable.`,
    `Early on I assumed more was better; I learned the first version usually needs iteration.`,
    `A lot of people underestimate how much iteration the details take before it's reliable.`,
  ],
  STRONG: (c) => [
    `I lead work in ${c.d.toLowerCase()} and have shipped it in production for years. The piece I'm proudest of is ${c.proj}, which I owned end to end.`,
    `I designed ${c.proj} with ${c.tool}; it moved ${c.metric}, and I drove it across ${c.team} from design through rollout.`,
    `The crux was the hard tradeoff: the naive approach was noisy, so I added a confidence threshold and only acted above that bar — that's what made it trustworthy.`,
    `The first version was too aggressive and people pushed back. I re-architected it to rank by confidence and impact, surfacing only high-value results — adoption jumped sharply.`,
    `I also led a migration with ${c.tool} that cut ${c.metric} under real production load; the tradeoff was operational complexity, so I invested heavily in observability and 80%+ test coverage.`,
    `Most people underestimate evaluation. Doing the work once is easy; building the harness that scores outputs against task-specific rubrics is what actually makes it reliable.`,
  ],
}

const PROFILES = [
  { name: 'Ethan Brooks', d: 'Backend Engineering', tier: 'STRONG', proj: 'an internal payments service', tool: 'FastAPI and Redis', metric: 'p99 latency 60%', team: 'the backend team' },
  { name: 'Priya Nair', d: 'Data Science', tier: 'MEDIUM', proj: 'a churn prediction model', tool: 'XGBoost and MLflow', metric: 'recall to 0.82', team: 'the data team' },
  { name: 'Marco Silva', d: 'Product Management', tier: 'STRONG', proj: 'an onboarding redesign', tool: 'a north-star activation metric', metric: 'activation 22%', team: 'a squad of six' },
  { name: 'Dana Cole', d: 'Enterprise Sales', tier: 'WEAK', proj: 'some deals', tool: 'the CRM', metric: 'quota', team: 'the sales team' },
  { name: 'Yuki Tanaka', d: 'Frontend Engineering', tier: 'MEDIUM', proj: 'a design-system migration', tool: 'React and TypeScript', metric: 'bundle size 30%', team: 'the web team' },
  { name: 'Amara Okonkwo', d: 'Machine Learning Engineering', tier: 'STRONG', proj: 'an LLM evaluation harness', tool: 'Python and rubric-based evals', metric: 'false positives 70%', team: 'the AI team' },
  { name: 'Liam Novak', d: 'DevOps Engineering', tier: 'MEDIUM', proj: 'a CI/CD overhaul', tool: 'GitHub Actions and Docker', metric: 'build times 55%', team: 'the infra team' },
  { name: 'Sofia Reyes', d: 'Full Stack Engineering', tier: 'WEAK', proj: 'a web app', tool: 'the usual stack', metric: 'stuff', team: 'the team' },
  { name: 'Noah Fischer', d: 'Security Engineering', tier: 'STRONG', proj: 'a threat-detection pipeline', tool: 'eBPF and anomaly models', metric: 'mean-time-to-detect 65%', team: 'the security team' },
  { name: 'Hana Kim', d: 'Growth Product', tier: 'MEDIUM', proj: 'a pricing experiment', tool: 'an A/B testing framework', metric: 'conversion 15%', team: 'growth and design' },
]

function buildTranscript(p) {
  const answers = TIERS[p.tier](p)
  const msgs = []
  for (let i = 0; i < MAYA_Q.length; i++) {
    msgs.push({ role: 'assistant', content: MAYA_Q[i] })
    msgs.push({ role: 'user', content: answers[i] })
  }
  return msgs
}

async function postRetry(path, body, tries = 6) {
  for (let t = 0; t < tries; t++) {
    try {
      const res = await fetch(BASE + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      if (res.status === 429 || res.status >= 500) { await sleep(4000 * (t + 1)); continue }
      return await res.json()
    } catch { await sleep(3000 * (t + 1)) }
  }
  return null
}

async function main() {
  // 1) clean old synthetic rows (all NULL-user test data)
  const deleted = await withPool(async (p) => (await p.query(`DELETE FROM expert_assessments WHERE candidate_user_id IS NULL`)).rowCount)
  console.log(`🧹 Cleaned ${deleted} old test rows.\n`)

  const results = []
  for (const p of PROFILES) {
    process.stdout.write(`▶ ${p.name} (${p.d}, ${p.tier})… `)
    const messages = buildTranscript(p)

    // report (expert-v2) + EIE profile (competencies, decision, quality)
    const rep = await postRetry('/api/interview', { action: 'report', assessmentType: 'domain_expert', candidate: { name: p.name, role: p.d }, messages, domainExpertise: p.d, sessionId: 'run10-' + p.name })
    const report = rep?.report || {}
    await sleep(2000)
    const eie = await postRetry('/api/eie/score', { role: p.d, seniority: 'senior', nRaters: 2, messages })
    const profile = eie?.profile || null
    if (profile) report.eie = profile

    await withPool((pool) => pool.query(
      `INSERT INTO expert_assessments (candidate_user_id, domain, transcript, report, expertise_score, expertise_level)
       VALUES (NULL, $1, $2::jsonb, $3::jsonb, $4, $5)`,
      [p.d, JSON.stringify(messages), JSON.stringify(report),
       Number.isFinite(report.expertise_score) ? report.expertise_score : null, report.expertise_level || null]
    ))

    const d = profile?.decision
    const q = profile?.interview_quality
    console.log(profile ? `✅ ${d?.band} · P(success) ${Math.round((d?.p_success || 0) * 100)}% · quality ${q?.grade} (${q?.score})` : '⚠️ saved (no EIE profile — rate limited)')
    results.push({ p, d, q })
    await sleep(6000) // pacing between interviews
  }

  console.log('\n' + '═'.repeat(62))
  console.log('10 DOMAIN EXPERT INTERVIEWS — summary')
  console.log('═'.repeat(62))
  for (const r of results) {
    console.log(`  ${r.p.name.padEnd(16)} ${r.p.d.padEnd(28)} ${r.p.tier.padEnd(7)} → ${r.d?.band || '—'} · quality ${r.q?.grade || '—'}`)
  }
}

main().catch((e) => { console.error('FATAL:', e.message); process.exit(1) })
