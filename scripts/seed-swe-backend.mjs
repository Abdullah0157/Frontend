// Seeds the item bank with:
//   1. All leaf skills from frameworks/skills-taxonomy.yaml
//   2. ~12 hand-authored SWE-Backend items across the 3 modalities we ship v1
//      (scenario_response, coding, mcq) — with placeholder psychometric params
//      that will be replaced by the calibration engine once we have responses.
//
// Idempotent: uses INSERT ... ON CONFLICT DO NOTHING for skills, and matches
// items by content_hash (SHA-256 of the prompt) so re-running doesn't dupe.

import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import pg from 'pg'

const env = readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
for (const line of env.split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.+?)\s*$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2]
}

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
})

const hash = (s) => createHash('sha256').update(s).digest('hex').slice(0, 40)

// ─── SKILLS from taxonomy ───────────────────────────────────────────────────
// Flat list matching frameworks/skills-taxonomy.yaml. Not YAML-parsed — this
// is the source of truth for the DB row shape.
const SKILLS = [
  // engineering.programming
  ['engineering.programming.python',        'Python',                     'engineering', 'programming', 'General Python proficiency'],
  ['engineering.programming.python_async',  'Python (async/concurrency)', 'engineering', 'programming', 'asyncio, threading, gil, event loop'],
  ['engineering.programming.typescript',    'TypeScript',                 'engineering', 'programming', null],
  ['engineering.programming.javascript',    'JavaScript',                 'engineering', 'programming', null],
  ['engineering.programming.go',            'Go',                         'engineering', 'programming', null],
  ['engineering.programming.rust',          'Rust',                       'engineering', 'programming', null],
  ['engineering.programming.java',          'Java',                       'engineering', 'programming', null],
  ['engineering.programming.sql',           'SQL',                        'engineering', 'programming', null],
  // engineering.system_design
  ['engineering.system_design.trade_offs',  'Trade-off reasoning',        'engineering', 'system_design', 'Choosing among alternatives under real constraints'],
  ['engineering.system_design.consistency', 'Consistency models',         'engineering', 'system_design', 'CAP, eventual vs strong, isolation'],
  ['engineering.system_design.scaling',     'Scaling strategy',           'engineering', 'system_design', 'Horizontal vs vertical, sharding, partitioning'],
  ['engineering.system_design.caching',     'Caching design',             'engineering', 'system_design', 'Invalidation, layering, hot keys'],
  ['engineering.system_design.queueing',    'Queueing & async flows',     'engineering', 'system_design', 'Brokers, back-pressure, delivery guarantees'],
  ['engineering.system_design.data_modeling','Data modeling',             'engineering', 'system_design', 'Schema, normalization, indexing'],
  // engineering.debugging
  ['engineering.debugging.hypothesis',      'Hypothesis-driven debugging','engineering', 'debugging', 'Forming and testing theories'],
  ['engineering.debugging.tools',           'Debugging tool fluency',     'engineering', 'debugging', 'Debuggers, tracers, profilers, EXPLAIN'],
  ['engineering.debugging.distributed',     'Distributed debugging',      'engineering', 'debugging', 'Cross-service log correlation, races'],
  // engineering.operations
  ['engineering.operations.monitoring',     'Monitoring design',          'engineering', 'operations', 'Metrics, SLIs/SLOs, alerting'],
  ['engineering.operations.incident_response','Incident response',        'engineering', 'operations', 'On-call, escalation, postmortems'],
  ['engineering.operations.reliability',    'Reliability engineering',    'engineering', 'operations', 'Driving measurable improvements'],
  // engineering.craft
  ['engineering.craft.correctness',         'Correctness',                'engineering', 'craft', 'Handling the edge cases the problem has'],
  ['engineering.craft.readability',         'Readability & maintainability','engineering', 'craft', null],
  ['engineering.craft.testing',             'Testing strategy',           'engineering', 'craft', 'What to test, at what layer'],
  ['engineering.craft.refactoring',         'Refactoring judgment',       'engineering', 'craft', null],
  // product
  ['product.strategy.market_sense',         'Market sensing',             'product', 'strategy', null],
  ['product.strategy.roadmap',              'Roadmap prioritization',     'product', 'strategy', null],
  ['product.strategy.metrics',              'Metric definition & analysis','product', 'strategy', null],
  ['product.execution.spec_writing',        'Spec / PRD writing',         'product', 'execution', null],
  ['product.execution.discovery',           'User discovery',             'product', 'execution', null],
  ['product.execution.prioritization',      'Prioritization under constraints','product', 'execution', null],
  // sales
  ['sales.discovery.qualifying',            'Lead qualifying',            'sales', 'discovery', 'MEDDIC / BANT'],
  ['sales.discovery.pain_finding',          'Pain identification',        'sales', 'discovery', null],
  ['sales.closing.objection_handling',      'Objection handling',         'sales', 'closing', null],
  ['sales.closing.negotiation',             'Negotiation',                'sales', 'closing', null],
  ['sales.pipeline.forecasting',            'Forecast accuracy',          'sales', 'pipeline', null],
  ['sales.pipeline.velocity',               'Deal velocity',              'sales', 'pipeline', null],
  // behavioral
  ['behavioral.communication.clarity',      'Explanation clarity',        'behavioral', 'communication', null],
  ['behavioral.communication.written',      'Written communication',      'behavioral', 'communication', null],
  ['behavioral.communication.listening',    'Active listening',           'behavioral', 'communication', null],
  ['behavioral.ownership.accountability',   'Accountability for outcomes','behavioral', 'ownership', null],
  ['behavioral.ownership.initiative',       'Initiative beyond scope',    'behavioral', 'ownership', null],
  ['behavioral.ownership.failure_reflection','Failure ownership',         'behavioral', 'ownership', null],
  ['behavioral.collaboration.conflict',     'Conflict handling',          'behavioral', 'collaboration', null],
  ['behavioral.collaboration.cross_functional','Cross-functional partnership','behavioral','collaboration', null],
  ['behavioral.leadership.mentorship',      'Mentorship',                 'behavioral', 'leadership', null],
  ['behavioral.leadership.decision_making', 'Decision-making under uncertainty','behavioral','leadership', null],
  ['behavioral.leadership.setting_norms',   'Setting team norms',         'behavioral', 'leadership', null],
  ['behavioral.problem_solving.decomposition','Problem decomposition',    'behavioral', 'problem_solving', null],
  ['behavioral.problem_solving.first_principles','First-principles reasoning','behavioral','problem_solving', null],
  ['behavioral.problem_solving.pragmatism', 'Pragmatic simplification',   'behavioral', 'problem_solving', null],
]

// ─── ITEMS — v1 seed for SWE-Backend ────────────────────────────────────────
// Each item has psychometric placeholders (alpha=1, beta=0, gamma=0) that
// will be updated by the calibration engine once we have >30 responses.
const ITEMS = [
  // ── Scenario responses (short-form written; AI-scored against rubric) ──
  {
    type: 'scenario_response', modality: 'written',
    primary_skill_code: 'engineering.system_design.trade_offs',
    secondary_skill_codes: ['engineering.system_design.scaling','behavioral.communication.clarity'],
    prompt: `A service you own is doing 1000 req/s. Product wants to 10x traffic in a quarter. Walk me through what you'd investigate FIRST and why. Be specific.`,
    reference_answer: `Look for expected bottlenecks: current p99 latency + CPU/memory headroom, DB query patterns, hot keys, cache hit rates, downstream services. Establish a load test baseline BEFORE optimizing. Cite specific metrics you'd check.`,
    scoring_rubric: {
      dimensions: [
        { name: 'specificity', weight: 0.4, anchors: {
          low: 'Generic ("scale it up", "add more servers")',
          high: 'Names specific metrics, tools, and expected bottlenecks with reasoning',
        }},
        { name: 'trade_off_reasoning', weight: 0.35, anchors: {
          low: 'One-track answer, no consideration of cost/risk',
          high: 'Discusses cost, risk, or team-capacity trade-offs explicitly',
        }},
        { name: 'ordering', weight: 0.25, anchors: {
          low: 'Starts optimizing before measuring',
          high: 'Establishes baseline measurement before intervention',
        }},
      ],
    },
    expected_time_s: 240, tags: ['scale', 'p99', 'senior'],
  },
  {
    type: 'scenario_response', modality: 'written',
    primary_skill_code: 'engineering.system_design.consistency',
    secondary_skill_codes: ['engineering.system_design.trade_offs'],
    prompt: `You're designing a payments settlement service. Downstream systems have a 15-minute SLA for reconciliation. Would you choose strong consistency (synchronous cross-region replication) or eventual (async replication)? Defend your choice and name at least one failure mode you'd accept.`,
    reference_answer: `Eventual is defensible here — 15min SLA tolerates async lag, and sync replication would add write latency + regional failure coupling. Accepted failure: brief settlement window where regions disagree; mitigated by reconciliation job.`,
    scoring_rubric: {
      dimensions: [
        { name: 'grasp_of_consistency', weight: 0.4, anchors: {
          low: 'Confuses ACID vs BASE, doesnt mention latency/availability trade-off',
          high: 'Cites CAP, latency cost of sync, replication semantics',
        }},
        { name: 'failure_mode_awareness', weight: 0.35, anchors: {
          low: 'Presents choice as risk-free',
          high: 'Names concrete failure mode and mitigation',
        }},
        { name: 'contextual_fit', weight: 0.25, anchors: {
          low: 'Ignores the SLA constraint',
          high: 'Ties decision explicitly to the 15-minute SLA',
        }},
      ],
    },
    expected_time_s: 300, tags: ['consistency', 'senior'],
  },
  {
    type: 'scenario_response', modality: 'written',
    primary_skill_code: 'behavioral.ownership.failure_reflection',
    secondary_skill_codes: ['behavioral.leadership.decision_making'],
    prompt: `Tell me about a technical decision you made that turned out to be wrong. What was the impact, and what did you change afterward — both about the system AND about your own decision-making process?`,
    reference_answer: `Look for: specific mistake with real consequences (metric, dollars, downtime); ownership language (not "the team messed up"); system change AND meta change (their process now includes X).`,
    scoring_rubric: {
      dimensions: [
        { name: 'specificity', weight: 0.35, anchors: {
          low: 'Vague ("we had some issues"); no metrics, no timeline',
          high: 'Specific event with named impact — numbers, downtime, or dollars',
        }},
        { name: 'ownership_language', weight: 0.35, anchors: {
          low: 'Blames others / external factors ("PM changed reqs", "infra was flaky")',
          high: 'First-person accountability without deflection',
        }},
        { name: 'meta_learning', weight: 0.3, anchors: {
          low: 'Fixed only the immediate symptom',
          high: 'Named a change to their own reasoning/process that prevents recurrence',
        }},
      ],
    },
    expected_time_s: 300, tags: ['behavioral', 'ownership'],
  },
  {
    type: 'scenario_response', modality: 'written',
    primary_skill_code: 'engineering.debugging.hypothesis',
    secondary_skill_codes: ['engineering.debugging.distributed','engineering.debugging.tools'],
    prompt: `Your service is intermittently returning 500s at 2am. No obvious pattern from the dashboard. Walk me through the FIRST 30 MINUTES of your investigation — not the answer, the process. Be specific about what you'd look at and in what order.`,
    reference_answer: `Should form hypotheses (traffic pattern? dependency? deploy?), check for correlated events (deploys, cron, upstream), look at error distribution (by host, by endpoint, by request feature), then narrow with logs/traces. Bad answers restart the service.`,
    scoring_rubric: {
      dimensions: [
        { name: 'method', weight: 0.5, anchors: {
          low: 'Print statements or "restart it"',
          high: 'Systematic hypothesis formation with narrowing tests',
        }},
        { name: 'tool_awareness', weight: 0.3, anchors: {
          low: 'No tool names or generic ("check the logs")',
          high: 'Names specific tools (jaeger, cloudwatch insights, EXPLAIN, tcpdump...)',
        }},
        { name: 'time_awareness', weight: 0.2, anchors: {
          low: 'Deep-dives one branch immediately',
          high: 'Explicitly ranks by likelihood/blast radius before spending time',
        }},
      ],
    },
    expected_time_s: 300, tags: ['debugging', 'oncall'],
  },
  {
    type: 'scenario_response', modality: 'written',
    primary_skill_code: 'behavioral.collaboration.conflict',
    secondary_skill_codes: ['behavioral.communication.clarity','behavioral.leadership.decision_making'],
    prompt: `Describe a specific technical disagreement you had with a teammate or manager. Not "we discussed it" — what did YOU argue, what did they argue, how did you resolve it, and how did the outcome play out?`,
    reference_answer: `Should show: real position with reasoning, understanding of counter-position (not straw-man), specific resolution path (design doc, small experiment, escalation), and outcome — including "I was wrong" if applicable.`,
    scoring_rubric: {
      dimensions: [
        { name: 'positions_articulated', weight: 0.35, anchors: {
          low: 'Only their position, other side is straw-manned',
          high: 'Both positions represented fairly with underlying reasoning',
        }},
        { name: 'resolution_process', weight: 0.35, anchors: {
          low: 'Purely social ("we talked it out"), no artifact or experiment',
          high: 'Named a concrete artifact/mechanism (doc, spike, escalation, poll)',
        }},
        { name: 'outcome_honesty', weight: 0.3, anchors: {
          low: 'Presents self as always-right',
          high: 'Names what actually happened; willing to say "I was wrong"',
        }},
      ],
    },
    expected_time_s: 240, tags: ['behavioral', 'collaboration'],
  },
  {
    type: 'scenario_response', modality: 'written',
    primary_skill_code: 'engineering.operations.reliability',
    secondary_skill_codes: ['engineering.operations.monitoring','engineering.operations.incident_response'],
    prompt: `Pick one production reliability improvement you drove that had a measurable outcome. What was the metric before, what did you change, what was the metric after, and how did you know the change was the reason (rather than something else)?`,
    reference_answer: `Look for: named metric with before/after numbers; specific intervention (not "we improved things"); causal reasoning ("we verified by X" — canary, A/B, staged rollout).`,
    scoring_rubric: {
      dimensions: [
        { name: 'measurement_before_after', weight: 0.4, anchors: {
          low: 'No numbers, no metric named',
          high: 'Metric named with before/after values and units',
        }},
        { name: 'attribution', weight: 0.35, anchors: {
          low: 'Assumes causation, no isolation',
          high: 'Cited how they isolated cause (canary, staged rollout, holdback)',
        }},
        { name: 'ownership', weight: 0.25, anchors: {
          low: '"The team" language, no personal role',
          high: 'Explicit personal role in the intervention',
        }},
      ],
    },
    expected_time_s: 240, tags: ['reliability', 'senior'],
  },

  // ── Coding items (v1 uses IDE modality; autograder + AI code review) ──
  {
    type: 'coding', modality: 'ide',
    primary_skill_code: 'engineering.programming.python',
    secondary_skill_codes: ['engineering.craft.correctness','engineering.craft.testing'],
    prompt: `Implement a rate limiter class that allows N requests per second per key.\n\nSignature:\n  class RateLimiter:\n      def __init__(self, requests_per_second: int): ...\n      def allow(self, key: str) -> bool: ...\n\nReturn True if the request is allowed, False if it should be denied. Assume single-process (no distributed coordination needed). Handle bursts, edge cases (0 rps, high load), and clean up per-key state to avoid unbounded memory growth.`,
    reference_answer: `Sliding-window log or token-bucket. Must handle: cleanup of stale keys, thread safety (or documented single-threaded), rps=0 rejecting all, high-throughput without O(n) per call.`,
    scoring_rubric: {
      dimensions: [
        { name: 'correctness', weight: 0.5, anchors: {
          low: 'Fails on rps=0 or bursts',
          high: 'Handles all documented edge cases',
        }},
        { name: 'algorithmic_soundness', weight: 0.3, anchors: {
          low: 'Naive O(n) per call, or reinvents in a wrong way',
          high: 'Amortized O(1) approach (token bucket or sliding window w/ deque cleanup)',
        }},
        { name: 'code_quality', weight: 0.2, anchors: {
          low: 'One 60-line function, no docstrings, magic numbers',
          high: 'Small helpers, clear naming, comments only where the WHY is non-obvious',
        }},
      ],
    },
    expected_time_s: 900, tags: ['coding', 'python', 'concurrency'],
  },
  {
    type: 'coding', modality: 'ide',
    primary_skill_code: 'engineering.programming.sql',
    secondary_skill_codes: ['engineering.system_design.data_modeling'],
    prompt: `Given these tables, write a SQL query that returns the top 5 customers by total spend in the last 30 days, along with their number of orders and average order value. Order by total spend desc.\n\ncustomers(id, name, email)\norders(id, customer_id, total_cents, created_at)\n\nOptimize for a table with 100M orders — mention any index you'd want.`,
    reference_answer: `SELECT c.id, c.name, SUM(o.total_cents) as total, COUNT(*) as n, AVG(o.total_cents) as avg FROM orders o JOIN customers c ON o.customer_id=c.id WHERE o.created_at >= NOW() - INTERVAL '30 days' GROUP BY c.id, c.name ORDER BY total DESC LIMIT 5;  Index: orders(customer_id, created_at) covering total_cents.`,
    scoring_rubric: {
      dimensions: [
        { name: 'query_correctness', weight: 0.5, anchors: {
          low: 'Wrong aggregates, missing GROUP BY, missing time filter',
          high: 'Correct query producing the right result',
        }},
        { name: 'index_awareness', weight: 0.35, anchors: {
          low: 'No mention of indexing',
          high: 'Specific compound/covering index proposed with reasoning',
        }},
        { name: 'edge_cases', weight: 0.15, anchors: {
          low: 'Ignores ties, NULLs, timezone',
          high: 'Notes ties handling, or timezone/NULL considerations',
        }},
      ],
    },
    expected_time_s: 600, tags: ['sql', 'performance'],
  },
  {
    type: 'coding', modality: 'ide',
    primary_skill_code: 'engineering.programming.typescript',
    secondary_skill_codes: ['engineering.craft.correctness'],
    prompt: `Implement a function debouncePromise<T extends (...args: any[]) => Promise<any>>(fn: T, ms: number): T that:\n1. Delays fn invocation until ms of quiet has passed.\n2. If called during that quiet period, resets the timer.\n3. Returns the same Promise to all callers waiting on the debounced fn — they should all resolve/reject with the ONE actual call's result.\n4. After the fn resolves, the next call should start a fresh debounce cycle.`,
    reference_answer: `Track pending promise + resolve/reject fns; reset timer on each call; when timer fires, invoke fn once and settle all waiting promises with its result.`,
    scoring_rubric: {
      dimensions: [
        { name: 'promise_semantics', weight: 0.5, anchors: {
          low: 'Creates a new promise per call, or doesnt share result',
          high: 'All in-flight callers get the same result from the one actual invocation',
        }},
        { name: 'timer_correctness', weight: 0.3, anchors: {
          low: 'Doesnt reset on repeat calls; leaks timer',
          high: 'Correctly resets and cleans up',
        }},
        { name: 'types', weight: 0.2, anchors: {
          low: 'Any everywhere; return type broken',
          high: 'Return type preserves the original signature',
        }},
      ],
    },
    expected_time_s: 900, tags: ['coding', 'typescript', 'async'],
  },

  // ── MCQ items (fast signal on foundational knowledge) ──
  {
    type: 'mcq', modality: 'written',
    primary_skill_code: 'engineering.system_design.consistency',
    prompt: `You have a Postgres primary with a read replica lagged ~200ms. A user updates their profile, then immediately reads it back. Which is the SAFEST default for the read?`,
    scoring_rubric: {
      choices: [
        { text: 'Read from the replica always — replication is fast enough', correct: false },
        { text: 'Read from the primary always', correct: false, partial: 0.5 },
        { text: 'Read from the primary for the user\'s own writes for a bounded window; replica otherwise', correct: true },
        { text: 'Always require synchronous replication so replica is always current', correct: false },
      ],
      explanation: `Read-your-writes consistency without paying sync replication cost. Common pattern.`,
    },
    expected_time_s: 60, tags: ['mcq', 'consistency'],
  },
  {
    type: 'mcq', modality: 'written',
    primary_skill_code: 'engineering.system_design.caching',
    prompt: `A cache-invalidation strategy where the app updates the DB, then deletes the cache entry. What's the most common failure mode?`,
    scoring_rubric: {
      choices: [
        { text: 'Cache and DB are always consistent', correct: false },
        { text: 'A concurrent reader can repopulate the cache with the OLD value between DB commit and cache delete', correct: true },
        { text: 'The DB write will fail', correct: false },
        { text: 'The cache will run out of memory', correct: false },
      ],
      explanation: `Classic cache-aside race. Mitigation: double-delete after a short delay, or use versioned keys, or cache-then-DB with 2PC (rarely worth it).`,
    },
    expected_time_s: 60, tags: ['mcq', 'caching'],
  },
  {
    type: 'mcq', modality: 'written',
    primary_skill_code: 'engineering.operations.monitoring',
    prompt: `Which of these is the BEST alerting signal for "user-facing degradation" on a request-response API?`,
    scoring_rubric: {
      choices: [
        { text: 'CPU utilization > 80%', correct: false },
        { text: 'Requests per second dropped 10%', correct: false },
        { text: 'p99 latency exceeded SLO for > 5 minutes', correct: true },
        { text: 'Error log volume increased', correct: false, partial: 0.4 },
      ],
      explanation: `SLO-based alerts (latency + errors above budget) are what users actually feel. CPU and RPS are causes, not symptoms.`,
    },
    expected_time_s: 45, tags: ['mcq', 'sre'],
  },
]

async function upsertSkills(pool) {
  let inserted = 0
  for (const [code, label, domain, subdomain, description] of SKILLS) {
    const r = await pool.query(
      `INSERT INTO skills (code, label, domain, subdomain, description)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (code) DO NOTHING`,
      [code, label, domain, subdomain, description]
    )
    if (r.rowCount > 0) inserted++
  }
  return inserted
}

async function upsertItems(pool) {
  let inserted = 0
  for (const item of ITEMS) {
    const contentHash = hash(item.prompt + (item.reference_answer || ''))
    // Skip if we've already seeded this exact prompt
    const existing = await pool.query(`SELECT 1 FROM items WHERE content_hash = $1`, [contentHash])
    if (existing.rowCount > 0) continue

    await pool.query(
      `INSERT INTO items (
         type, modality, primary_skill_code, secondary_skill_codes,
         prompt, reference_answer, scoring_rubric, expected_time_s,
         difficulty_beta, discrimination_alpha, guessing_gamma,
         tags, content_hash, status
       ) VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8,$9,$10,$11,$12,$13,'live')`,
      [
        item.type, item.modality, item.primary_skill_code,
        item.secondary_skill_codes || [],
        item.prompt, item.reference_answer || null,
        JSON.stringify(item.scoring_rubric),
        item.expected_time_s,
        // Psychometric placeholders — will be replaced by calibration engine.
        0.0,   // beta (average difficulty)
        1.0,   // alpha (moderate discrimination)
        item.type === 'mcq' ? 0.25 : 0.0,  // gamma (guessing floor for 4-choice MCQ)
        item.tags || [],
        contentHash,
      ]
    )
    inserted++
  }
  return inserted
}

try {
  const skillsInserted = await upsertSkills(pool)
  const itemsInserted = await upsertItems(pool)
  const skillCount = (await pool.query(`SELECT COUNT(*)::int AS n FROM skills`)).rows[0].n
  const itemCount = (await pool.query(`SELECT COUNT(*)::int AS n FROM items WHERE status = 'live'`)).rows[0].n
  console.log(`✓ Skills: +${skillsInserted} new (total: ${skillCount})`)
  console.log(`✓ Items:  +${itemsInserted} new (total live: ${itemCount})`)
} catch (e) {
  console.error('Seed failed:', e.message)
  process.exitCode = 1
} finally {
  await pool.end()
}
