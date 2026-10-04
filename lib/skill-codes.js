// Skill codes the written-assessment banks may use. Existing codes come from
// frameworks/skills-taxonomy.yaml; the `added` ones were introduced for the
// written assessments (each has real items measuring it, per the taxonomy's
// "no orphan skills" rule). The seeder inserts any missing ones.
// [code, label, domain, subdomain]

const EXISTING = [
  ['engineering.programming.javascript', 'JavaScript (runtime + language)', 'engineering', 'programming'],
  ['engineering.programming.typescript', 'TypeScript', 'engineering', 'programming'],
  ['engineering.programming.python', 'Python', 'engineering', 'programming'],
  ['engineering.programming.python_async', 'Python (async/concurrency)', 'engineering', 'programming'],
  ['engineering.programming.sql', 'SQL', 'engineering', 'programming'],
  ['engineering.system_design.trade_offs', 'Trade-offs', 'engineering', 'system_design'],
  ['engineering.system_design.consistency', 'Consistency', 'engineering', 'system_design'],
  ['engineering.system_design.scaling', 'Scaling', 'engineering', 'system_design'],
  ['engineering.system_design.caching', 'Caching', 'engineering', 'system_design'],
  ['engineering.system_design.queueing', 'Queueing', 'engineering', 'system_design'],
  ['engineering.system_design.data_modeling', 'Data modelling', 'engineering', 'system_design'],
  ['engineering.debugging.hypothesis', 'Hypothesis-driven debugging', 'engineering', 'debugging'],
  ['engineering.debugging.tools', 'Debugging tools', 'engineering', 'debugging'],
  ['engineering.debugging.distributed', 'Distributed debugging', 'engineering', 'debugging'],
  ['engineering.operations.monitoring', 'Monitoring', 'engineering', 'operations'],
  ['engineering.operations.incident_response', 'Incident response', 'engineering', 'operations'],
  ['engineering.operations.reliability', 'Reliability', 'engineering', 'operations'],
  ['engineering.craft.correctness', 'Correctness', 'engineering', 'craft'],
  ['engineering.craft.readability', 'Readability', 'engineering', 'craft'],
  ['engineering.craft.testing', 'Testing', 'engineering', 'craft'],
  ['engineering.craft.refactoring', 'Refactoring', 'engineering', 'craft'],
  ['behavioral.communication.clarity', 'Clarity', 'behavioral', 'communication'],
  ['behavioral.communication.written', 'Written communication', 'behavioral', 'communication'],
  ['behavioral.communication.listening', 'Listening', 'behavioral', 'communication'],
  ['behavioral.ownership.accountability', 'Accountability', 'behavioral', 'ownership'],
  ['behavioral.ownership.initiative', 'Initiative', 'behavioral', 'ownership'],
  ['behavioral.ownership.failure_reflection', 'Reflecting on failure', 'behavioral', 'ownership'],
  ['behavioral.collaboration.conflict', 'Handling conflict', 'behavioral', 'collaboration'],
  ['behavioral.collaboration.cross_functional', 'Cross-functional work', 'behavioral', 'collaboration'],
  ['behavioral.leadership.mentorship', 'Mentorship', 'behavioral', 'leadership'],
  ['behavioral.leadership.decision_making', 'Decision making', 'behavioral', 'leadership'],
  ['behavioral.leadership.setting_norms', 'Setting norms', 'behavioral', 'leadership'],
  ['behavioral.problem_solving.decomposition', 'Decomposition', 'behavioral', 'problem_solving'],
  ['behavioral.problem_solving.first_principles', 'First principles', 'behavioral', 'problem_solving'],
  ['behavioral.problem_solving.pragmatism', 'Pragmatism', 'behavioral', 'problem_solving'],
]

const ADDED = [
  ['engineering.backend.api_design', 'API design', 'engineering', 'backend'],
  ['engineering.backend.http', 'HTTP', 'engineering', 'backend'],
  ['engineering.data.transactions', 'Transactions and locking', 'engineering', 'data'],
  ['engineering.data.indexing', 'Indexes and query performance', 'engineering', 'data'],
  ['engineering.security.injection', 'Injection attacks', 'engineering', 'security'],
  ['engineering.security.auth', 'Authentication and authorisation', 'engineering', 'security'],
  ['engineering.security.data_protection', 'Protecting data and secrets', 'engineering', 'security'],
  ['engineering.concurrency.fundamentals', 'Concurrency', 'engineering', 'concurrency'],
  ['engineering.performance.complexity', 'Performance and complexity', 'engineering', 'performance'],
  ['engineering.tooling.git', 'Git', 'engineering', 'tooling'],
  ['engineering.tooling.containers', 'Containers', 'engineering', 'tooling'],
  ['engineering.algorithms.data_structures', 'Data structures', 'engineering', 'algorithms'],
]

export const SKILL_ROWS = [...EXISTING, ...ADDED]
export const ALLOWED_SKILLS = new Set(SKILL_ROWS.map((r) => r[0]))
