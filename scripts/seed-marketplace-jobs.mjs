// Seeds 20 companies across different industries with 2-3 roles each (~50 jobs),
// including pay: hourly contracts, fixed-price projects, and annual salaries.
//
// Adds the pay columns first (idempotent ALTERs) since interview_jobs had no
// way to express compensation at all.
//
// Run:    cd ~/jobstream-fe-deploy && node --env-file=.env.local scripts/seed-marketplace-jobs.mjs
// Undo:   node --env-file=.env.local scripts/seed-marketplace-jobs.mjs --remove
import pg from 'pg'

const url = process.env.DATABASE_URL
if (!url) { console.error('NO DATABASE_URL'); process.exit(1) }
const REMOVE = process.argv.includes('--remove')

// [title, level, stack, whatYouDo, payType, min, max]
// payType: 'hourly' (per hour) | 'fixed' (whole project) | 'salary' (per year)
const COMPANIES = [
  ['Northwind Labs', 'B2B SaaS', 'builds workflow tooling for operations teams', [
    ['Senior Backend Engineer', 'senior', 'Python, FastAPI, PostgreSQL', 'design services that stay correct under load and mentor the wider backend team', 'salary', 110000, 145000],
    ['Frontend Engineer', 'mid', 'React, TypeScript, Tailwind', 'own features end to end and keep the interface fast and accessible', 'salary', 80000, 105000],
    ['DevOps Contractor', 'senior', 'Kubernetes, Terraform, AWS', 'rebuild the deployment pipeline and hand over documented infrastructure', 'hourly', 70, 95],
  ]],
  ['Meridian Financial', 'Fintech', 'runs payments and reconciliation infrastructure', [
    ['Payments Backend Engineer', 'senior', 'Java, Spring Boot, Kafka', 'build transaction services where a rounding error is a production incident', 'salary', 120000, 160000],
    ['Compliance Analyst', 'mid', 'regulatory reporting, controls, audit', 'keep product changes inside regulatory boundaries and prepare for audits', 'salary', 70000, 90000],
  ]],
  ['Halcyon AI', 'Artificial Intelligence', 'ships language and vision products to enterprise customers', [
    ['Machine Learning Engineer', 'mid', 'PyTorch, evaluation, model serving', 'train and ship models, and own the metrics that prove they work', 'salary', 105000, 140000],
    ['NLP Engineer', 'senior', 'transformers, RAG, evaluation harnesses', 'build retrieval systems and evaluation that catches real failure modes', 'salary', 125000, 165000],
    ['Prompt Engineering Consultant', 'mid', 'prompt design, LLM evaluation', 'audit and rewrite production prompts, delivering a measured before/after', 'fixed', 9000, 9000],
  ]],
  ['Verdant Health', 'Healthcare Technology', 'builds clinical software for outpatient providers', [
    ['Full Stack Engineer', 'mid', 'React, Node.js, PostgreSQL, HL7', 'ship patient-facing features under real clinical safety constraints', 'salary', 90000, 120000],
    ['Clinical Data Analyst', 'mid', 'SQL, Python, healthcare data', 'turn messy clinical data into reporting clinicians actually trust', 'salary', 75000, 95000],
  ]],
  ['Cobalt Logistics', 'Supply Chain', 'operates freight routing and warehouse software', [
    ['Backend Engineer', 'mid', 'Go, PostgreSQL, message queues', 'build routing services that keep working when carriers send bad data', 'salary', 85000, 110000],
    ['Data Engineer', 'senior', 'Airflow, dbt, Snowflake', 'own the pipelines behind shipment reporting and keep them on time', 'salary', 100000, 130000],
    ['Integrations Contractor', 'mid', 'REST, EDI, webhooks', 'build and document carrier integrations against inconsistent partner APIs', 'hourly', 55, 75],
  ]],
  ['Lumen Retail', 'E-commerce', 'runs a multi-brand online storefront', [
    ['Frontend Engineer', 'mid', 'Next.js, TypeScript, performance', 'own storefront performance where a slow page costs real revenue', 'salary', 80000, 105000],
    ['Storefront Redesign Contractor', 'senior', 'Next.js, design systems', 'deliver a rebuilt checkout flow as a fixed-scope engagement', 'fixed', 15000, 15000],
  ]],
  ['Ironwood Construction', 'Construction Technology', 'digitises site management for contractors', [
    ['Mobile Engineer', 'mid', 'React Native, offline sync', 'build apps that work on sites with no signal and sync cleanly later', 'salary', 85000, 110000],
    ['QA Engineer', 'junior', 'manual and automated testing', 'test across devices and catch regressions before crews hit them on site', 'salary', 55000, 70000],
  ]],
  ['Solstice Energy', 'Renewable Energy', 'monitors and optimises solar installations', [
    ['IoT Backend Engineer', 'senior', 'Python, time-series data, MQTT', 'ingest telemetry from thousands of inverters without losing readings', 'salary', 105000, 135000],
    ['Data Scientist', 'mid', 'forecasting, Python, statistics', 'forecast generation and quantify how wrong the forecast usually is', 'salary', 90000, 120000],
    ['Dashboard Contractor', 'mid', 'React, charting, data viz', 'build a customer-facing performance dashboard to an agreed scope', 'fixed', 11000, 11000],
  ]],
  ['Anchor Legal', 'Legal Technology', 'automates contract review for in-house teams', [
    ['Backend Engineer', 'mid', 'Python, NLP, PostgreSQL', 'build document processing that handles genuinely messy contracts', 'salary', 90000, 118000],
    ['Legal Operations Analyst', 'mid', 'contracts, process design', 'map legal workflows into something the product can actually automate', 'salary', 70000, 92000],
  ]],
  ['Quill Media', 'Digital Media', 'publishes subscription journalism', [
    ['Full Stack Engineer', 'mid', 'Next.js, Node.js, CMS', 'build publishing tools editors use every day under deadline pressure', 'salary', 78000, 100000],
    ['SEO Engineer (Contract)', 'senior', 'technical SEO, Core Web Vitals', 'audit and fix technical SEO across a large content archive', 'hourly', 60, 85],
  ]],
  ['Basalt Security', 'Cybersecurity', 'provides managed detection and response', [
    ['Security Engineer', 'senior', 'threat detection, SIEM, incident response', 'hunt threats and turn each incident into a durable detection rule', 'salary', 115000, 150000],
    ['Application Security Engineer', 'mid', 'appsec, code review, threat modelling', 'review architecture and code for security risk before it ships', 'salary', 95000, 125000],
    ['Penetration Tester (Contract)', 'senior', 'offensive security, reporting', 'run a scoped external penetration test and deliver a written report', 'fixed', 18000, 18000],
  ]],
  ['Harbor Insurance', 'Insurance Technology', 'modernises claims processing', [
    ['Backend Engineer', 'mid', 'C#, .NET, SQL Server', 'replace batch claims processing with services that fail safely', 'salary', 85000, 112000],
    ['Business Analyst', 'mid', 'requirements, process mapping', 'translate underwriting rules into specifications engineers can build', 'salary', 68000, 88000],
  ]],
  ['Kestrel Travel', 'Travel Technology', 'builds booking software for tour operators', [
    ['Backend Engineer', 'mid', 'Node.js, PostgreSQL, third-party APIs', 'integrate booking systems that are slow, flaky and inconsistent', 'salary', 80000, 105000],
    ['Frontend Engineer', 'junior', 'React, TypeScript', 'build booking interfaces and learn the domain with senior support', 'salary', 55000, 72000],
  ]],
  ['Fable Games', 'Gaming', 'develops live-service mobile games', [
    ['Gameplay Engineer', 'mid', 'Unity, C#, performance', 'build gameplay systems that hold frame rate on low-end devices', 'salary', 85000, 115000],
    ['Backend Engineer, Live Ops', 'senior', 'Go, Redis, real-time systems', 'run live-service backends where downtime is immediately visible', 'salary', 110000, 140000],
    ['Game Economy Consultant', 'senior', 'game economy, analytics', 'model and rebalance the in-game economy as a fixed-scope engagement', 'fixed', 12000, 12000],
  ]],
  ['Tessera Education', 'EdTech', 'builds assessment tools for universities', [
    ['Full Stack Engineer', 'mid', 'React, Python, PostgreSQL', 'build assessment features where correctness affects student grades', 'salary', 78000, 100000],
    ['Accessibility Engineer', 'mid', 'WCAG, ARIA, screen readers', 'make the product genuinely usable for students with disabilities', 'salary', 82000, 105000],
  ]],
  ['Alloy Manufacturing', 'Industrial IoT', 'connects factory equipment to the cloud', [
    ['Embedded Engineer', 'senior', 'C, RTOS, sensors', 'write firmware for equipment that must run untouched for years', 'salary', 105000, 135000],
    ['Platform Engineer', 'mid', 'Kubernetes, Go, observability', 'run the platform ingesting data from thousands of factory devices', 'salary', 95000, 122000],
  ]],
  ['Cedar Property', 'PropTech', 'manages rental portfolios for landlords', [
    ['Full Stack Engineer', 'mid', 'Next.js, Node.js, PostgreSQL', 'build tenant and landlord tooling with money movement involved', 'salary', 82000, 105000],
    ['Product Designer (Contract)', 'senior', 'Figma, design systems', 'redesign the tenant portal and deliver a documented design system', 'fixed', 14000, 14000],
  ]],
  ['Nimbus Cloud', 'Cloud Infrastructure', 'provides managed container hosting', [
    ['Site Reliability Engineer', 'senior', 'Kubernetes, Prometheus, on-call', 'own uptime for customer workloads and lead incident response', 'salary', 120000, 155000],
    ['Backend Engineer', 'mid', 'Go, distributed systems', 'build control-plane services that stay correct during partial failure', 'salary', 95000, 125000],
    ['Technical Writer (Contract)', 'mid', 'developer docs, API reference', 'rewrite the API documentation developers currently complain about', 'hourly', 45, 65],
  ]],
  ['Vantage Analytics', 'Data & BI', 'sells analytics tooling to mid-market firms', [
    ['Analytics Engineer', 'mid', 'dbt, SQL, warehousing', 'model warehouse data so dashboards agree with each other', 'salary', 85000, 110000],
    ['Data Visualisation Engineer', 'mid', 'D3, React, charting', 'build chart components that stay readable with real, messy data', 'salary', 88000, 112000],
  ]],
  ['Orchid Beauty', 'Consumer D2C', 'sells skincare direct to consumers', [
    ['E-commerce Engineer', 'mid', 'Shopify, Node.js, integrations', 'own the storefront and the systems behind fulfilment', 'salary', 72000, 95000],
    ['Growth Analyst', 'junior', 'SQL, experimentation, marketing data', 'measure campaigns honestly and report what actually drove revenue', 'salary', 55000, 72000],
    ['Email Automation Contractor', 'mid', 'lifecycle marketing, automation', 'build and document the lifecycle email programme end to end', 'hourly', 40, 60],
  ]],
]

const slugify = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
const money = (n) => `$${n.toLocaleString('en-US')}`
function payLine(type, min, max) {
  if (type === 'hourly') return `${money(min)}–${money(max)} per hour`
  if (type === 'fixed') return `${money(min)} fixed price for the engagement`
  return `${money(min)}–${money(max)} per year`
}

const rows = []
for (const [company, industry, blurb, jobs] of COMPANIES) {
  for (const [title, level, stack, doing, payType, min, max] of jobs) {
    const slug = `${slugify(company)}-${slugify(title)}`
    rows.push({
      external_job_id: `demo:${slug}`, slug, title, role: title, company,
      pay_type: payType, pay_min: min, pay_max: max,
      description:
        `${company} ${blurb}. Industry: ${industry}.\n\n` +
        `We are hiring a ${title} (${level} level). Compensation: ${payLine(payType, min, max)}.\n\n` +
        `In this role you will ${doing}.\n\n` +
        `Core skills: ${stack}.\n\n` +
        `What we look for: specific work you have owned end to end, clear reasoning about the trade-offs ` +
        `you chose and why, and an honest account of something that went wrong and what you changed as a result.`,
    })
  }
}

const c = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } })
await c.connect()

if (REMOVE) {
  const { rowCount } = await c.query(`DELETE FROM interview_jobs WHERE external_job_id LIKE 'demo:%'`)
  console.log(`✓ removed ${rowCount} demo job(s)`)
  await c.end(); process.exit(0)
}

// interview_jobs had no way to express pay at all. Additive and idempotent.
await c.query(`ALTER TABLE interview_jobs ADD COLUMN IF NOT EXISTS pay_type text`)
await c.query(`ALTER TABLE interview_jobs ADD COLUMN IF NOT EXISTS pay_min integer`)
await c.query(`ALTER TABLE interview_jobs ADD COLUMN IF NOT EXISTS pay_max integer`)
await c.query(`ALTER TABLE interview_jobs ADD COLUMN IF NOT EXISTS pay_currency text DEFAULT 'USD'`)
console.log('✓ pay columns ready')

let added = 0
for (const r of rows) {
  const res = await c.query(
    `INSERT INTO interview_jobs
       (slug, title, role, description, company, external_job_id, is_active, pay_type, pay_min, pay_max, pay_currency)
     VALUES ($1,$2,$3,$4,$5,$6,true,$7,$8,$9,'USD')
     -- The unique index on external_job_id is PARTIAL (WHERE ... IS NOT NULL),
     -- so the predicate has to be repeated here or Postgres can't infer it (42P10).
     ON CONFLICT (external_job_id) WHERE external_job_id IS NOT NULL DO UPDATE SET
       pay_type = EXCLUDED.pay_type, pay_min = EXCLUDED.pay_min,
       pay_max  = EXCLUDED.pay_max,  description = EXCLUDED.description`,
    [r.slug, r.title, r.role, r.description, r.company, r.external_job_id, r.pay_type, r.pay_min, r.pay_max]
  )
  added += res.rowCount
}

const { rows: byType } = await c.query(
  `SELECT COALESCE(pay_type,'none') t, COUNT(*)::int n FROM interview_jobs WHERE is_active GROUP BY 1 ORDER BY 1`)
const { rows: cos } = await c.query(
  `SELECT COUNT(DISTINCT company)::int n FROM interview_jobs WHERE is_active AND company IS NOT NULL`)
const { rows: tot } = await c.query(`SELECT COUNT(*)::int n FROM interview_jobs WHERE is_active`)

console.log(`✓ seeded ${rows.length} job(s) across ${COMPANIES.length} companies\n`)
console.log('By pay type:'); byType.forEach(r => console.log(`  ${r.t.padEnd(8)} ${r.n}`))
console.log(`\nDistinct companies: ${cos[0].n}   ·   Total active jobs: ${tot[0].n}`)
await c.end()
