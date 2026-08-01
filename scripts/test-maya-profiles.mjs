// End-to-end rubric-alignment test for Maya (Domain Expert interview).
// Runs 3 full interviews — WEAK / MEDIUM / STRONG candidates — generates the
// rubric report for each, saves them to expert_assessments, and prints the
// scores so we can verify the AI grading is calibrated (weak < medium < strong).

import { readFileSync } from 'node:fs'
import pg from 'pg'

const env = readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
for (const line of env.split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.+?)\s*$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2]
}
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } })

const BASE = 'http://localhost:3002/api/interview'
const DOMAIN = 'Full Stack AI Engineering'
const FOCUS = ['AI code review tooling', 'FastAPI migration', 'LLM integration', 'evaluation frameworks']

// Scripted answers per profile quality. Given per turn (intro first).
const PROFILES = {
  WEAK: {
    label: 'Weak candidate',
    answers: [
      "Uh yeah, I'm a developer. I did some coding and some AI stuff at a company.",
      "We just used best practices and it mostly worked out, I think.",
      "I'm not really sure about the details — the team handled a lot of that part.",
      "It was fine. Nothing really broke that I can remember.",
      "I guess I'm good at figuring things out when I need to.",
      "Not really, I don't think I have a specific answer for that one.",
    ],
  },
  MEDIUM: {
    label: 'Medium candidate',
    answers: [
      "I'm a full stack developer with a few years of experience, mostly Python and React. I built some internal tools at my job.",
      "I made a code review tool using the OpenAI API that left comments on pull requests. It helped the team a bit.",
      "It used the OpenAI API to look at code and post comments. I connected it with GitHub webhooks so it ran on new PRs.",
      "Sometimes it gave wrong suggestions, so we had to tune the prompts. It took some trial and error to get it usable.",
      "I think I'm decent at backend work and integrating APIs. I still have things to learn about scaling and infrastructure.",
      "One thing I learned is that prompts need a lot of iteration before they're reliable enough to trust.",
    ],
  },
  STRONG: {
    label: 'Strong candidate',
    answers: [
      "I lead three engineering teams at Elite Techlogix across AI, mobile, and web. Over four years I've built production backends in FastAPI and Django and AI features on the OpenAI API. The work I'm proudest of is an internal AI code review tool.",
      "It posts automated review comments directly on GitHub PRs — flagging PEP 8 violations and common anti-patterns before a human reviewer looks at the diff. It cut manual review requests by about 40 percent. I designed the whole pipeline end to end.",
      "It hooks into GitHub webhooks, pulls the diff, chunks it to fit the model's context window, and runs a rubric-based evaluation prompt. The hard part was noisy false positives, so I added a confidence threshold and only let it comment when it's above that bar.",
      "The first version commented on every tiny style nit and engineers hated it. I re-architected it to score each finding by confidence and impact, and only surface the high-value ones. Comment volume dropped about 70 percent and adoption went up sharply.",
      "I also led migrating a legacy Django monolith to async FastAPI with Redis task queues, which cut p99 response times by 60 percent under production load. The tradeoff was operational complexity, so I invested heavily in observability and testing standards, 80 percent plus coverage.",
      "Most people who claim AI-engineering expertise underestimate evaluation. Making the model call is easy; building the eval harness that scores outputs against task-specific rubrics is what actually makes it reliable. That's where I spend most of my time.",
    ],
  },
}

async function askQuestion(messages, progressRatio) {
  const res = await fetch(BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'question', assessmentType: 'domain_expert',
      candidate: { name: 'Test', role: DOMAIN },
      messages, domainExpertise: DOMAIN, focusAreas: FOCUS,
      progressRatio, totalQuestions: 8, sessionId: 'test-' + progressRatio,
    }),
  })
  const ct = res.headers.get('content-type') || ''
  if (ct.includes('text/plain')) {
    let out = ''
    const reader = res.body.getReader(); const dec = new TextDecoder()
    while (true) { const { done, value } = await reader.read(); if (done) break; out += dec.decode(value, { stream: true }) }
    return out.trim()
  }
  return (await res.json()).question
}

async function generateReport(messages) {
  const res = await fetch(BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'report', assessmentType: 'domain_expert',
      candidate: { name: 'Test', role: DOMAIN },
      messages, domainExpertise: DOMAIN, sessionId: 'test-report',
    }),
  })
  const data = await res.json()
  return data.report
}

async function runInterview(profile) {
  const messages = []
  const nAnswers = profile.answers.length
  for (let i = 0; i < nAnswers; i++) {
    const progress = i / nAnswers
    const q = await askQuestion(messages, progress)
    messages.push({ role: 'assistant', content: q })
    messages.push({ role: 'user', content: profile.answers[i] })
  }
  const report = await generateReport(messages)
  return { messages, report }
}

async function main() {
  const results = []
  for (const key of ['WEAK', 'MEDIUM', 'STRONG']) {
    const profile = PROFILES[key]
    process.stdout.write(`\n▶ Running ${profile.label} interview… `)
    const { messages, report } = await runInterview(profile)
    if (!report) { console.log('❌ no report'); continue }
    console.log(`done. score=${report.expertise_score}/10 level=${report.expertise_level}`)

    // Save to expert_assessments so it shows in the admin rubric view.
    await pool.query(
      `INSERT INTO expert_assessments (candidate_user_id, domain, transcript, report, expertise_score, expertise_level)
       VALUES (NULL, $1, $2::jsonb, $3::jsonb, $4, $5)`,
      [`${DOMAIN} · TEST-${key}`, JSON.stringify(messages), JSON.stringify(report),
       Number.isFinite(report.expertise_score) ? report.expertise_score : null, report.expertise_level || null]
    )
    results.push({ key, label: profile.label, report })
    await new Promise(r => setTimeout(r, 1500)) // gentle pacing
  }

  console.log('\n' + '═'.repeat(64))
  console.log('RUBRIC ALIGNMENT — expected WEAK < MEDIUM < STRONG')
  console.log('═'.repeat(64))
  for (const r of results) {
    const s = r.report.internal_scores || {}
    console.log(`\n${r.label}: ${r.report.expertise_score}/10 · ${r.report.expertise_level}`)
    console.log(`  internal: depth=${s.domain_depth} practical=${s.practical_experience} comm=${s.communication} problem=${s.problem_solving} teaching=${s.teaching_ability}`)
    console.log(`  summary: ${(r.report.domain_summary||'').slice(0,140)}`)
    console.log(`  gaps: ${(r.report.knowledge_gaps||[]).slice(0,2).join(' | ')}`)
  }
  const scores = results.map(r => r.report.expertise_score)
  const aligned = scores.length === 3 && scores[0] < scores[1] && scores[1] < scores[2]
  console.log('\n' + (aligned ? '✅ ALIGNED: weak < medium < strong' : `⚠️ CHECK ORDERING: ${scores.join(' , ')}`))
  await pool.end()
}

main().catch(e => { console.error('FATAL:', e.message); process.exit(1) })
