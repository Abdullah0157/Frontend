// Seeds 3 demo companies with 10 roles each (30 jobs) so candidates have
// something real to interview for.
//
// Idempotent: every job carries a stable external_job_id, and the insert uses
// ON CONFLICT DO NOTHING, so re-running adds nothing and duplicates nothing.
//
// Run: cd ~/jobstream-fe-deploy && node --env-file=.env.local scripts/seed-demo-jobs.mjs
// Undo: node --env-file=.env.local scripts/seed-demo-jobs.mjs --remove
import pg from 'pg'

const url = process.env.DATABASE_URL
if (!url) { console.error('NO DATABASE_URL'); process.exit(1) }
const REMOVE = process.argv.includes('--remove')

// Descriptions are deliberately substantive: the interview is primed from the
// job description, so a one-line stub produces a shallow, generic interview.
const COMPANIES = [
  {
    name: 'Northwind Labs',
    blurb: 'a remote-first B2B SaaS company building workflow tooling for operations teams',
    jobs: [
      ['Junior Frontend Engineer', 'junior', 'React, TypeScript, CSS', 'build and maintain UI components against designs, fix visual bugs across breakpoints, and learn the codebase with mentorship from senior engineers'],
      ['Frontend Engineer', 'mid', 'React, TypeScript, Tailwind', 'own features end to end in the web app, build reusable components, and keep the interface fast and accessible'],
      ['Backend Engineer', 'mid', 'Node.js, PostgreSQL, REST APIs', 'design and ship API endpoints, model data in Postgres, and keep services reliable under growing load'],
      ['Senior Backend Engineer', 'senior', 'Python, FastAPI, PostgreSQL, Redis', 'lead backend architecture decisions, design services for scale and failure, and mentor mid-level engineers'],
      ['Full Stack Engineer', 'mid', 'React, Node.js, PostgreSQL', 'work across the stack shipping complete features, from schema through API to interface'],
      ['DevOps Engineer', 'mid', 'Docker, Kubernetes, CI/CD, AWS', 'own deployment pipelines, container infrastructure and monitoring, and reduce time from merge to production'],
      ['QA Automation Engineer', 'mid', 'Playwright, Jest, CI pipelines', 'build automated test coverage for critical flows and catch regressions before they reach customers'],
      ['Product Manager', 'mid', 'discovery, roadmapping, metrics', 'own a product area, decide what gets built and why, and work with engineering and design from discovery to launch'],
      ['Technical Support Engineer', 'junior', 'SQL, log analysis, customer communication', 'diagnose customer issues, reproduce bugs for engineering, and turn recurring problems into product fixes'],
      ['Engineering Manager', 'lead', 'people leadership, delivery, architecture', 'lead a team of six engineers, own delivery and technical direction, and grow the people on the team'],
    ],
  },
  {
    name: 'Meridian Financial',
    blurb: 'an enterprise fintech running payments and reconciliation infrastructure at scale',
    jobs: [
      ['Senior Backend Engineer', 'senior', 'Java, Spring Boot, PostgreSQL, Kafka', 'build transaction-processing services where correctness is non-negotiable, and design for auditability and recovery'],
      ['Data Engineer', 'mid', 'Python, Airflow, dbt, Snowflake', 'build and maintain data pipelines feeding reporting and reconciliation, and keep data correct and on time'],
      ['Security Engineer', 'senior', 'threat modelling, appsec, incident response', 'review architecture for security risk, run incident response, and raise the security baseline across engineering'],
      ['Site Reliability Engineer', 'senior', 'Kubernetes, Terraform, observability, on-call', 'own reliability targets for production payment systems, lead incident response, and remove recurring toil'],
      ['Database Engineer', 'senior', 'PostgreSQL, query tuning, replication', 'own schema design, indexing and replication for high-volume transactional workloads'],
      ['Solutions Architect', 'lead', 'system design, integrations, client delivery', 'design integrations for enterprise clients and translate their requirements into a workable architecture'],
      ['Business Analyst', 'mid', 'requirements, process mapping, SQL', 'work between business stakeholders and engineering to turn ambiguous requirements into specifications'],
      ['Enterprise Sales Executive', 'senior', 'complex sales, discovery, negotiation', 'own enterprise deals end to end, run discovery with finance leaders, and manage long procurement cycles'],
      ['Compliance Analyst', 'mid', 'regulatory reporting, audit, controls', 'maintain regulatory controls, prepare for audits, and keep product changes within compliance boundaries'],
      ['Engineering Lead', 'lead', 'architecture, delivery, mentorship', 'set technical direction for a payments squad, own architecture decisions and delivery outcomes'],
    ],
  },
  {
    name: 'Halcyon AI',
    blurb: 'an applied AI company shipping language and vision products to enterprise customers',
    jobs: [
      ['Machine Learning Engineer', 'mid', 'PyTorch, model training, evaluation', 'train, evaluate and ship models into production, and own the metrics that say whether they actually work'],
      ['MLOps Engineer', 'senior', 'model serving, pipelines, monitoring', 'build the infrastructure that gets models into production reliably and keeps them monitored once there'],
      ['Data Scientist', 'mid', 'statistics, experimentation, Python', 'design experiments, analyse results honestly, and turn findings into product decisions'],
      ['NLP Engineer', 'senior', 'transformers, RAG, evaluation', 'build language systems including retrieval pipelines, and design evaluation that catches real failure modes'],
      ['Computer Vision Engineer', 'mid', 'CNNs, detection, image pipelines', 'build vision models and the data pipelines that feed them, from labelling through to deployment'],
      ['AI Research Engineer', 'senior', 'experimentation, papers, prototyping', 'turn research ideas into working prototypes and evaluate whether they beat the current approach'],
      ['Backend Engineer, AI Infrastructure', 'senior', 'Python, GPUs, distributed systems', 'build the serving layer behind model inference, focused on latency, cost and throughput'],
      ['AI Product Manager', 'senior', 'AI products, evaluation, roadmap', 'own an AI product area, decide what to build, and define what "good enough to ship" means for a probabilistic system'],
      ['Prompt Engineer', 'mid', 'prompt design, evaluation, LLM behaviour', 'design and systematically evaluate prompts, and build the harnesses that measure whether changes help'],
      ['Technical Writer', 'mid', 'developer docs, API reference', 'write documentation developers actually use, covering APIs, guides and model behaviour'],
    ],
  },
]

const slugify = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

const rows = []
for (const co of COMPANIES) {
  for (const [title, seniority, stack, doing] of co.jobs) {
    const slug = `${slugify(co.name)}-${slugify(title)}`
    rows.push({
      external_job_id: `demo:${slug}`,
      slug,
      title,
      role: title,
      company: co.name,
      description:
        `${co.name} is ${co.blurb}. We are hiring a ${title} (${seniority} level).\n\n` +
        `In this role you will ${doing}.\n\n` +
        `Core stack and skills: ${stack}.\n\n` +
        `What we look for: concrete examples of work you have owned end to end, clear reasoning about trade-offs ` +
        `you made and why, and honesty about what went wrong and what you changed as a result.`,
    })
  }
}

const c = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } })
await c.connect()

if (REMOVE) {
  const { rowCount } = await c.query(`DELETE FROM interview_jobs WHERE external_job_id LIKE 'demo:%'`)
  console.log(`✓ removed ${rowCount} demo job(s)`)
  await c.end()
  process.exit(0)
}

let added = 0
for (const r of rows) {
  const res = await c.query(
    `INSERT INTO interview_jobs (slug, title, role, description, company, external_job_id, is_active)
     VALUES ($1,$2,$3,$4,$5,$6,true)
     ON CONFLICT (external_job_id) DO NOTHING`,
    [r.slug, r.title, r.role, r.description, r.company, r.external_job_id]
  )
  added += res.rowCount
}

const { rows: counts } = await c.query(
  `SELECT company, COUNT(*)::int n FROM interview_jobs WHERE is_active GROUP BY company ORDER BY company`
)
console.log(`✓ inserted ${added} new job(s) (${rows.length - added} already present)\n`)
console.log('Active jobs by company:')
counts.forEach(r => console.log(`  ${(r.company || '(none)').padEnd(22)} ${r.n}`))
const { rows: tot } = await c.query(`SELECT COUNT(*)::int n FROM interview_jobs WHERE is_active`)
console.log(`\nTotal active jobs: ${tot[0].n}`)
await c.end()
