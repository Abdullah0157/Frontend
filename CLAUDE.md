# JobStream — The AI Hiring Operating System

> This is a strategic + technical blueprint. Read Parts 1–9 before touching code — they explain WHY the current architecture will be changed and what target we are building toward. Parts 10+ describe the codebase as it exists today.

---

## Part 1 — Vision & North Star

We are not building an AI interviewer. We are not building an ATS. We are building the **operating system for hiring**.

Every screen, every workflow, every database, every AI system, every agent — one intelligent platform. Sourcing → interviews → evaluation → decisions → offers → onboarding → workforce analytics.

The end state is a category-defining company with a **durable technical moat that cannot be copied with prompts alone**. Advantage comes from architecture, memory, workflows, reasoning, data models, network effects, and evaluation defensibility.

---

## Part 2 — The Real Moat (or: why prompts are not a moat)

Four durable moats, in priority order. Every architectural decision must support these:

1. **Outcome-linked evaluation data.** Interview scores linked to hire decisions linked to performance reviews linked to retention data. When we can say *"candidates we scored 8+ on 'engineering rigor' retained at 91% at 18 months across 40,000 hires"* — that statement is worth billions. Requires 3–5 years of data. Cannot start collecting too early.
2. **Calibrated competency taxonomy per role family.** Not one universal rubric. A published, versioned, empirically-tuned framework per role: `SWE-Backend-L4`, `PM-Consumer-Senior`, `Sales-Enterprise-AE`. Each with competencies, scoring anchors, question banks, and inter-rater reliability data.
3. **Integration depth as switching cost.** Bidirectional syncs with Greenhouse/Lever/Ashby/Workday/BambooHR + Google Calendar/Outlook + Slack + Zoom + Gmail. Irreplaceable inside the enterprise workflow.
4. **Two-sided data network effect.** Candidates get a portable verified interview record. Companies get access to a pre-assessed pool. Value accretes on both sides.

**Not moats:** prompt engineering, voice quality, "multi-agent" as a pitch phrase, fancy UI. All copyable in a quarter.

---

## Part 3 — Reality Check: What the Current Codebase Gets Wrong

These are the load-bearing problems in the code as of today. Fix these before adding features.

1. **No institutional memory.** Every interview starts from zero. No cross-interview learning, no cross-candidate calibration, no cross-company benchmarking.
2. **The rubric is invented at report time.** `reportInstruction` in `app/api/interview/route.js` asks Gemini to invent 5 skills per interview. Same candidate scored twice gets different rubrics. Not calibratable. Not comparable. Not EEOC-defensible. **This is the single biggest architectural problem.**
3. **Prompt injection surface.** `[GUIDANCE: ...]` appended to user turns. Enterprises will fail our SOC 2 review over this pattern. Guidance belongs in `systemInstruction` or in tool-called agents.
4. **Single-vendor fragility.** Gemini free tier is 20 req/min; Groq is the fallback. No eval harness, no prompt version pinning, no regression suite, no canary rollouts.
5. **No candidate identity graph.** Same person applying to 3 companies = 3 disconnected rows in `interview_candidates`. We cannot answer "how did they perform across their last 5 interviews?" That data is the moat.
6. **Report is a JSON blob.** `report JSONB` in Postgres — cannot query `WHERE technical_score > 8 AND role = 'SWE'` without full scans. Fine at 100 interviews, fatal at 100,000.
7. **Synchronous request/response everywhere.** No event bus, no queue, no idempotency keys. Interviews need to be event-sourced state machines, not HTTP round-trips.
8. **Chrome-only STT** and a fragile dual pipeline (Web Speech for silence detection + Whisper for accuracy). Adds 5–8s latency after every candidate answer.
9. **No feedback loop.** We generate a recommendation, then nothing. Was the hire made? Did they perform? Did they stay? Without those signals, scores are statistically meaningless.

---

## Part 4 — The Architectural Spine (three primitives)

### Primitive 1: The Competency Graph

The single source of truth for what "good" looks like per role. Versioned.

```
CompetencyFramework (versioned)
└── RoleFamily (SWE-Backend, PM-Consumer, Sales-AE, …)
    └── SeniorityBand (L3, L4, L5, L6, …)
        └── Competency (System Design, Ownership, Communication, …)
            ├── ScoringAnchor (1..9 with concrete descriptions per level)
            ├── EvidenceType (project_walkthrough, failure_analysis, …)
            └── QuestionBank[] (calibrated, tagged, versioned)
```

Every score is `(candidate_id, competency_id, framework_version, score, confidence, evidence_ids[])`. Queryable, calibratable, defensible.

### Primitive 2: The Candidate Knowledge Graph

One canonical identity per person (email + phone + LinkedIn + resume hash + heuristic dedupe). Everything attaches as evidence.

```
Candidate (node)
├── Identity: {emails[], phones[], linkedin_url, github, resume_hashes[]}
├── Claims (from resume): "Led team of 8", "Shipped feature X"
├── EvidenceRelation → Interview.Response.Snippet
│       ├── Verified | Contradicted | Unverified
│       ├── Confidence: 0-1
│       └── Source: interview_id, timestamp, agent_id
├── CompetencyAssessments: [(competency, score, framework_version)]
├── OutcomeSignals: [{company, hired, performance_review, tenure_days}]
└── Interactions: [applications, interviews, offers, feedback]
```

Postgres + pgvector for OLTP; materialized graph views for queries. Neo4j only if graph query patterns dominate.

### Primitive 3: The Interview Runtime (event-sourced)

An interview is a long-running stateful process with an append-only event log.

```
InterviewSession
├── State: pending | active | paused | completed | abandoned | flagged
├── EventLog (append-only):
│    ├── SessionStarted
│    ├── QuestionPlanned {agent: planner, competency_target}
│    ├── QuestionAsked {text, prompt_hash, model_version}
│    ├── ResponseReceived {transcript, audio_ref, whisper_confidence}
│    ├── EvidenceExtracted {claims[], competency_signals[]}
│    ├── ContradictionDetected {against_evidence_id}
│    ├── ProctoringFlagRaised {type, severity}
│    ├── ScoreUpdated {competency, delta, reason}
│    └── SessionCompleted
└── Materialized views: candidate_scores, interview_report, audit_log
```

Benefits: replayable when framework changes, auditable for GDPR "right to explanation", resumable on browser crash, A/B testable by reprocessing old logs against new agents.

Substrate: Postgres LISTEN/NOTIFY + jobs table for first 12 months → Kafka/Redpanda as scale demands.

---

## Part 5 — Iris v2: Multi-Agent Interview Runtime

Not a committee of chat models. A **planning loop with typed tools**.

**Layer 1 — Presenter (Iris the character):** small fast model, one voice, one personality. Turn-taking, empathy, acknowledgment, pacing. Converts a `NextTurn` decision into natural speech. Does NOT decide what to ask.

**Layer 2 — Planner (the brain):** one planning agent, `plan → act → observe` loop after every response. State = event log. Tools = Layer 3 specialists. Output = `NextTurn: { intent, target_competency, question_hint, reasoning }`. Model class: Sonnet or Gemini-2.5-Pro. Do not use a small model here.

**Layer 3 — Specialist tools:**
- `ExtractEvidence(response) → Claim[]`
- `DetectContradiction(claim, candidate_graph) → Contradiction | null` (RAG over candidate's own graph)
- `ScoreResponse(response, competency, anchors) → {score_delta, confidence, evidence_refs}`
- `AssessDepth(response, question) → {surface | detailed | deep | expert}`
- `RiskFlag(response, session) → RiskSignal[]` (collusion, coaching, memorization)
- `ProctoringCheck(camera_frame, screen_delta) → Anomaly[]` (CV models, not LLM path)
- `RetrievePriorEvidence(competency, candidate_graph)`

Each tool: independently testable, versionable, swappable, A/B-able.

### Eval Harness (build second, not last)

Before Iris v2 ships:
- **Golden dataset:** 500 interviews scored by expert humans, per role family
- **Regression suite:** every prompt change reruns against golden set, reports score deltas
- **Inter-rater reliability:** Iris vs. human agreement, target Cohen's κ > 0.75
- **Adversarial set:** memorized answers, coached responses, resume lies — measure catch rate

---

## Part 6 — Role Workspaces (what "OS" actually means)

Shared substrate (graph, event log, framework, notifications, automations, planner) + thin role-shaped surfaces on top. Each role sees a projection + a scoped agent.

### Candidate workspace
Portable verified interview record. Practice interviews (freemium, top-of-funnel). Application status. One prep-focused AI thread. **DO NOT** build a career coach / learning platform — that's a different company and puts us in competition with our B2B customers.

### Recruiter workspace ← highest revenue density
Model after Linear, not Salesforce. Cmd-K command bar. Single "today" view: candidates to review, interviews to schedule, offers to send, contacts to nurture. Recruiter's copilot ("Chief of Staff") owns inbox + calendar, drafts follow-ups, ranks pipeline daily. **Recruiters will pay $500/seat/month if this saves them 10 hours/week.**

### Hiring manager workspace
Almost entirely read-only. Single-page candidate view: report, transcript with highlights, comparison against last 5 candidates for this role, one-click structured decision. Async-first. Never more than 4 minutes per candidate.

### Company admin workspace
Hiring plan, budget, requisitions, org chart, team perf, compliance dashboard, integrations, billing. Workday-lite. Build sparse — evaluated on demos, not daily use.

### Super Admin (internal ops)
Not customer-facing. Revenue, retention cohorts, AI cost per interview, model drift, failed jobs, support queue, feature flags, tenant health. Retool for years 1–2. Do not spend engineering cycles on polish.

### Permissions: ABAC, not RBAC
Standard RBAC is not enough. Attribute-based policies via OpenFGA or Oso. Every read/write goes through a policy check. Log every access. Enterprises ask about this in month one.

### Automations: curated library, not workflow builder
30 shipped automations cover 90% of needs. The visual builder is a v3 problem after we know which automations customers actually customize.

---

## Part 7 — Data Model (target schema)

```sql
-- Identity & tenancy
organizations (id, name, plan, ...)
workspaces (id, org_id, ...)
users (id, ...)
memberships (user_id, workspace_id, role, permissions_jsonb)

-- Framework (the moat)
competency_frameworks (id, version, published_at)
role_families (id, framework_id, name, code)
seniority_bands (id, role_family_id, name, level)
competencies (id, seniority_band_id, name, description)
scoring_anchors (id, competency_id, score, description)
question_bank (id, competency_id, text, evidence_types[], version)

-- Candidate graph
candidates (id, canonical_identity_hash, ...)
candidate_identities (candidate_id, type, value)
candidate_claims (id, candidate_id, source, text, verified_status)
candidate_evidence (id, candidate_id, competency_id, session_id,
                    turn_id, evidence_type, snippet, embedding vector)
candidate_scores (id, candidate_id, competency_id, framework_version,
                  score, confidence, computed_at, computed_by)

-- Interview runtime
interview_sessions (id, candidate_id, job_id, state, framework_version, ...)
interview_events (id, session_id, seq, type, payload_jsonb, actor, ts)
interview_turns (id, session_id, seq, question_text, response_text,
                 response_audio_ref, planner_reasoning, model_versions_jsonb)

-- Jobs & pipeline
jobs (id, org_id, role_family_id, seniority_band_id, ...)
job_stages (id, job_id, name, order, sla_hours)
applications (id, candidate_id, job_id, current_stage_id, ...)
stage_transitions (id, application_id, from_stage, to_stage, actor, reason, ts)

-- Outcomes (the flywheel)
hires (id, candidate_id, job_id, offer_amount, start_date, ...)
outcome_signals (id, hire_id, type, value, source, ts)
  -- type: performance_review_score | terminated | resigned | promoted |
  --       manager_regret_score | retention_days | pip_placed
```

Critical decisions baked in:
- **`framework_version` on every score** — old scores stay interpretable; can re-score on framework updates
- **`outcome_signals` as separate table** — the loop. Design ingestion before we need it, or we never will.
- Transcripts + audio in S3 (lifecycle policies); vectors in pgvector; audio retained 90 days by default, transcripts forever (per-org retention overrides for GDPR)

---

## Part 8 — Evaluation Defensibility (unlocks enterprise sales)

- **EEOC / Uniform Guidelines:** every question job-related, every score tied to documented competencies, adverse impact monitored per protected class per role, report available to customers
- **Bias audits:** independent third-party annually (required by NYC Local Law 144)
- **Explainability:** every score cites specific evidence + reasoning ("Score 6 because: candidate could not articulate consistency trade-offs (turn 12), gave superficial answer to sharding question (turn 15)")
- **Human-in-the-loop:** Iris never rejects unilaterally. Rejections require human confirmation.
- **Versioning:** every score tied to `(framework_version, prompt_hash, model_id)` — reproducible, auditable
- **Data residency:** EU customers → EU-hosted data. Plan at schema layer (`tenant → region`), not as afterthought.
- **Compliance cert sequence:** SOC 2 Type I (m6) → SOC 2 Type II (m12) → GDPR baseline → ISO 27001 (y2) → FedRAMP (y3+)

---

## Part 9 — 24-Month Sequenced Roadmap

### Months 0–3: Foundation refactor
- Refactor interview state → event log + turns table
- Ship first competency framework (SWE-Backend + one more — start narrow)
- Rewrite report gen → structured `candidate_scores` tied to competencies
- Eval harness with 100 hand-labeled interviews
- Prompt/model versioning on every LLM call
- Fix prompt-injection surface
- Observability: LLM call logs, cost tracking, latency histograms

### Months 3–6: Iris v2 planner + tools
- Split Presenter / Planner / Tools layers
- Ship EvidenceExtractor, ContradictionDetector, StructuredScorer
- Voice latency reduction: streaming Whisper, parallel STT/TTS priming
- Candidate identity resolution service
- Recruiter workspace v1 (today view, pipeline, command bar)

### Months 6–12: The graph and the loop
- Migrate to graph-backed candidate model
- ATS integrations: Greenhouse → Ashby → Lever
- Outcome ingestion API — start collecting hire/no-hire, retention data
- Hiring manager workspace (async review, comparisons)
- SOC 2 Type I
- 3rd competency framework (Sales-AE or PM-Consumer)

### Months 12–18: Enterprise + calibration data
- SSO/SAML/SCIM
- ABAC policy engine
- Bias audit + adverse impact dashboard
- First calibration study: are our scores predictive of outcomes?
- Multi-language interviews (ES → PT → HI)
- Recruiter copilot v1 (inbox + calendar + drafts)

### Months 18–24: Flywheel visible externally
- Cross-company benchmarking (differential privacy for aggregates)
- First empirical whitepaper: "Which interview signals predict retention?"
- Candidate portable interview record
- Workflow automation library
- SOC 2 Type II

By month 24: defensible framework + sticky integrations + outcome data no competitor has + a recruiter product people pay real money for. Shape of a Series C narrative → $1B+ round.

---

## Part 10 — What NOT to Build

More important than the roadmap. Actively resist:
- No-code workflow builder (ship 30 curated automations first)
- Resume builder (different company)
- "Learning platform" for candidates (different company; competes with our B2B customers)
- Interview scheduling engine from scratch (integrate with Calendly / Google Cal / Outlook)
- Video conferencing (use Zoom SDK / Whereby / Daily)
- Universal AI interviewer for every role on day one (ship one, prove validity, expand)
- Marketplace (needs liquidity we don't have; candidate-side later)
- Our own foundation model (fine-tune small task-specific models for scoring/extraction/contradiction only; reasoning brain stays Sonnet/Gemini/GPT)
- Multi-region infrastructure before a customer needs it

---

## Part 11 — Assessment Intelligence Layer

The AI Hiring OS and the Assessment Intelligence Platform are ONE product with three GTMs, not two products. Same substrate (competency framework, candidate graph, evidence layer, event-sourced runtime). Different customer segments consume different projections:

| Segment | GTM | Primary UI |
|---|---|---|
| Hiring teams (B2B) | Sales-led enterprise | Recruiter workspace |
| L&D / Career (B2C+B2B2C) | Product-led | Candidate skill profile |
| Certification bodies / Universities | Partnership | White-label API |

### 11.1 The moat (what makes it defensible)

**The calibrated item bank + cumulative skill graph, linked to outcomes.**

- Every item (question, coding task, scenario, video prompt) has psychometric properties: difficulty `beta`, discrimination `alpha`, guessing `gamma` (Item Response Theory)
- Every person has a persistent skill graph updated across every assessment they've taken
- Outcomes flow back (hire → performance → retention) → recalibrates items and rescoring formulas
- After 100K assessments, item bank is 10x more valid than competitors. After 1M, 100x. Compounds.

**NOT the moat:** AI assessment generator, anti-cheating, multi-modal assessment types, marketplace, certifications. All commodities or 5-year problems.

### 11.2 Four architectural primitives

**Primitive 1 — Item Bank**
```sql
items (id, version, type, modality, competency_id, difficulty_beta,
       discrimination_alpha, guessing_gamma, reliability_kr20,
       n_administered, tags[], content_hash, scoring_rubric_id, status)
item_responses (id, item_id, candidate_id, session_id, raw_response jsonb,
                score, score_confidence, time_spent_ms, ai_evaluation jsonb,
                human_review jsonb, created_at)
item_calibration_history (item_id, version, alpha, beta, gamma, n_at_time, computed_at)
```
Types: `mcq | coding | scenario_response | voice_response | video_response | system_design`.
Modalities: `written | voice | video | ide`.

**Primitive 2 — Skill Graph (per candidate)**
```sql
skills (id, code, parent_id, domain)  -- 'python.async' → 'python' → 'programming'
candidate_skill_state (candidate_id, skill_id, theta, theta_se, confidence,
                       n_responses, last_updated_at)  -- IRT ability estimate
candidate_skill_evidence (id, candidate_id, skill_id, item_response_id,
                          evidence_type, evidence_weight, quote, ai_reasoning)
candidate_skill_transitions (candidate_id, skill_id, from_theta, to_theta,
                             trigger_item_response_id, ts)  -- audit log
```
`theta` is comparable across assessments because items are calibrated on the same scale. `theta_se` is the honesty layer — "ability 1.2 ± 0.4" prevents confusing a well-measured average person with a poorly-measured strong one.

**Primitive 3 — Adaptive Assessment Engine**
Real IRT-based item selection (Fisher Information maximization at candidate's current θ), not "harder if right." Bayesian EAP updates. Stopping when `theta_se < threshold` OR content coverage met OR time exhausted.

**Primitive 4 — Evaluation + Evidence Layer**
Extends Sprint 2 report validation into general-purpose runtime. Each response type has a scorer + evidence extractor:
- MCQ: deterministic scorer
- Coding: autograder (unit tests) + AI code review (rubric-scored)
- Written scenario: AI-scored against rubric with turn refs
- Voice interview: Iris + structured report (exists)
- System design: LLM eval + diagram capture

Every score has `raw_score`, `confidence`, `evidence_refs`, `rubric_id`, `rubric_version`.

### 11.3 Full data model connecting everything

```
Assessment (config: what to test, how)
  → target_competencies[], item_selection_policy, time_limit, stopping_rules, proctoring_config

AssessmentSession (a live run)
  → candidate_id, assessment_id, state, events[] (append-only, event-sourced per Part 6),
    item_responses[], final_report_id

Report (immutable snapshot)
  → session_id, candidate_skill_deltas[], strengths, concerns (Sprint 2 structured format),
    validation_block, framework_version, model_versions

CandidateProfile (public/private graph view)
  → skill_graph_snapshot, verified_certifications, assessment_history, learning_recommendations
```

### 11.4 What to build vs skip

**Ship v1 (Q1):**
- Item bank (substrate)
- 3 modalities: voice interview (Iris — exists), coding assessment (browser IDE + autograder + AI review), written scenario response
- 3 role families: SWE-Backend, PM-Consumer, Sales-AE (NOT all 60)
- Adaptive engine (real IRT)
- Skill graph (persistent per candidate)
- Structured report with evidence links (extend Sprint 2)
- Candidate profile (public/shareable)

**Ship v2 (Q2-Q3):**
- AI Assessment Generator (role description → assessment plan from item bank)
- System design + architecture assessment
- 3 more role families
- Company-scoped private item banks
- Cross-assessment signal fusion

**Ship v3 (Q4+):**
- Video prompt assessment
- Simulated project assessment
- Evidence-backed certification framework
- Company-to-company curated sharing (NOT open marketplace)

**DON'T BUILD (18+ months out):**
- Public assessment marketplace (needs two-sided liquidity)
- 40+ assessment categories (start with 3, add on demand)
- Separate "Roleplay Engine" / "Simulation Engine" products (they're modalities inside the assessment engine)
- Custom foundation models (fine-tune small task models only)
- "AI Certification" as day-one differentiator (needs ecosystem acceptance)

### 11.5 Anti-cheating — honest positioning

"We detect at rates comparable to the industry, we're honest about our limits, and our multi-modal assessment design makes cheating harder than the alternatives."

Priority defenses:
1. **Multi-modal design** — must code AND explain AND defend live → LLM-only cheating breaks
2. **Behavioral consistency** — typing pace consistency, sudden mid-item changes flagged
3. **Live voice interview after async work** — massive deterrent
4. **Item exposure management** — retire items showing up on cheat sites
5. **Statistical anomaly detection** — score too high given time+length+device
6. Hygiene: browser lockdown, camera, tab tracking, LLM detector (tiebreaker only)

Don't oversell. Enterprises ask for false-positive rate; claim what you can measure.

### 11.6 Connection to what already exists

~60% of the architecture is in the current codebase:
- `frameworks/swe-backend-v1.yaml` → seed for `competencies` and `scoring_rubrics`
- Iris `computeInterviewState()` → pattern for adaptive item selection
- Sprint 2 `validateReport()` → pattern for evidence verification across item types
- `interview_sessions` + `messages` → event-sourced runtime; generalize to `assessment_sessions` + `events`
- Report JSONB → migrate to structured `candidate_skill_deltas`

Missing:
- `items` table + item bank management UI
- IRT calibration engine (batch job re-fitting parameters as responses accumulate)
- `candidate_skill_state` table (persistent graph)
- Skill taxonomy (extend competency framework)
- Coding assessment engine (IDE + autograder + AI code review)
- AI item generator (competency + difficulty → candidate items → human review → live)

### 11.7 Assessment-specific roadmap

**Months 0–3:** Skill taxonomy · migrate report to `candidate_skill_deltas` · add `items` + `item_responses` + `candidate_skill_state` tables · seed 100 hand-authored items for SWE-Backend · ship simple non-adaptive coding assessment. **Deliverable:** candidate does coding + Iris interview, gets report with skill graph update.

**Months 3–6:** IRT scoring + item selection · calibration study (100 known-quality candidates) · candidate skill profile page · AI item generator with human-in-loop review. **Deliverable:** meaningfully adaptive assessments; 500+ calibrated items.

**Months 6–12:** Scenario + video modalities · 3 role families live · shareable candidate skill profile · first evidence-backed certification (internal-only) · outcome data pipeline. **Deliverable:** measurable differentiation strong vs weak candidates, backed by data.

**Months 12–24:** Publish first predictive-validity study · multi-language · company-scoped private banks · cross-assessment signal fusion. **Deliverable:** "The only assessment platform with published predictive validity."

---

---

# CURRENT IMPLEMENTATION (as of 2026-07-25)

> Everything above is the target. Everything below is what exists today. When they conflict, the target wins — refactor toward it.

## Project Overview
B2B SaaS AI interview platform. Companies post jobs, candidates complete AI-powered voice interviews, Iris (the AI interviewer) conducts the conversation, generates a scored report. Built with Next.js 14 App Router.

**Dev server:** `npm run dev` → `http://localhost:3000` (or `PORT=3002 npm run dev`)
**Production:** https://jobstream-ai.vercel.app (Vercel alias set via CLI)
**Stack:** Next.js 14, Supabase (auth + PostgreSQL), Gemini 2.5 Flash (AI), Groq llama-3.3-70b (AI fallback), msedge-tts (TTS), Groq Whisper whisper-large-v3 (STT), Web Speech API (live display + silence detection)

---

## Environment Variables (`.env.local`)
```
GEMINI_API_KEY=...
GEMINI_API_KEY_FALLBACK=...        # second key tried on 429
NEXT_PUBLIC_GEMINI_MODEL=gemini-2.5-flash
DATABASE_URL=postgresql://postgres.lssvpgbokrkxbytrifax:...
NEXT_PUBLIC_SUPABASE_URL=https://lssvpgbokrkxbytrifax.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
GROQ_API_KEY=...                    # for Whisper STT + Groq fallback
```
**Gemini free tier = 20 req/min.** Heavy testing exhausts quota. Both keys are free tier. If you see 429, wait 2 minutes before retrying.

**Supabase redirect URLs** — must include `https://jobstream-ai.vercel.app/auth/callback` in Auth → URL Configuration for Google OAuth to work on prod.

---

## Interview Flow (end-to-end)
```
Candidate visits /interview/[slug] or /jobs/[id]/interview
  → PermissionGate (camera + full-screen share + mic required)
    → InterviewExperience.js (orchestrator)
      → primeInterview() → POST /api/interview/prime  (JD+resume pre-analysis)
      → fetchQuestion()  → POST /api/interview (action: 'question', streams text)
        → VoiceChat.js (voice UI)
          → msedge-tts via POST /api/tts  → Web Audio API playback
          → Web Speech API (SpeechRecognition, continuous=true)
          → after 5.5s silence → MediaRecorder → /api/stt (Groq Whisper)
          → after 15s no speech → promptAfterSilence()
      → after totalQuestions answered → POST /api/interview (action: 'report')
      → POST /api/jobs/[id]/candidates  (save report to DB)
```

### Auth
- Middleware: `lib/supabase/middleware.js`
- Protected routes: `/jobs`, `/profile`, `/company`, `/interview`
- Supabase email confirmation IS enabled — cannot create test accounts headlessly
- Google OAuth: no `prompt: 'select_account'` (removed for speed); loading state on all Google buttons
- **Temp dev bypass still exists** — search `DEV_BYPASS` in `lib/supabase/middleware.js`

---

## Key Files

### AI Interview Engine
**`app/api/interview/route.js`**
- `action: 'question'` — streams next question via Gemini SSE
- `action: 'report'` — returns JSON report (non-streaming)
- Iris prompt: `irisPersona()` + stage-aware `questionInstruction()` with 5 phases (greeting → warmup → technical core → pressure → closing)
- Domain Expert mode: `assessmentType: 'domain_expert'` → Maya persona
- ⚠️ `[GUIDANCE: ...]` injected into user turns — **prompt injection surface, refactor per Part 3**
- ⚠️ Rubric invented per-interview — **refactor to structured framework per Part 4/6**

**`app/api/interview/prime/route.js`**
- Pre-analyzes JD + resume before Q1
- Returns `{ keySkills, gapAreas, questionFocus, seniority, totalQuestions }`
- Sets total question count dynamically: 5 (jr/mid), 6 (sr), 7 (lead)
- Falls back to hardcoded default on error (interview still works)

**`lib/gemini.js`**
- `callGemini` / `callGeminiStream` — tries `GEMINI_API_KEY` then `GEMINI_API_KEY_FALLBACK`
- On 429/401/403/5xx across both keys → falls through to Groq (llama-3.3-70b, non-streaming)
- Groq body conversion: Gemini format → OpenAI-compatible format

**Report JSON shape (current — refactor to structured `candidate_scores`):**
```json
{
  "score": 8,
  "recommendation": "strong_yes|yes|maybe|no",
  "summary": "...",
  "strengths": ["..."],
  "concerns": ["..."],
  "highlight_quote": "...",
  "rubric": [{"skill":"...","score":8,"evidence":"..."}],
  "technical_assessment": "...",
  "behavioral_assessment": "...",
  "risk_factors": ["..."],
  "internal_scores": {"technical":8,"communication":7,"problem_solving":8,"behavioral":8,"confidence":7,"role_fit":9}
}
```

### TTS Pipeline
**`lib/tts.js`** — `primeTTS()`, `getAudioContext()`, `speakText()`
- `primeTTS()` MUST be called inside a user gesture (`PermissionGate` "Begin Interview" button)
- Two separate try/catches: speechSynthesis, AudioContext
- Plays 1-sample silent buffer through AudioContext to definitively activate
- `speakText()` (browser SpeechSynthesis) is legacy — main pipeline uses msedge-tts server

**`lib/tts-client.js`** — `playServerTTS(text, {onStart, onEnd, onError})`, `stopServerTTS()`
- Primary: `_playWebAudio()` via AudioContext + `decodeAudioData`
- Fallback: `_playBlobFromArrayBuffer()` if decode fails
- Fallback: `_playStreaming()` (MediaSource API) or `_playBlob()` if no AudioContext

**`app/api/tts/route.js`** — msedge-tts server route
- Voices: AriaNeural (default), JennyNeural, MichelleNeural, AvaNeural, EmmaNeural, SoniaNeural, LibbyNeural, NatashaNeural
- Returns `audio/mpeg` stream, max 4000 chars

### Voice Recognition
**`components/VoiceChat.js`**
- Dual pipeline: Web Speech API (live text + silence detection) + MediaRecorder → Groq Whisper (accurate final)
- `SILENCE_MS = 5500` — 5.5s silence → `autoSubmit()`
- `NO_SPEECH_MS = 15000` — 15s no speech → `promptAfterSilence()`
- `lastAudioRef` audio-energy guard defers submit if volume detected in last 2.5s
- `isTestPhrase()`, `isRepeatRequest()` for meta-commands
- ⚠️ Adds 5–8s latency after each answer — **biggest UX pain point**
- ⚠️ Chrome/Edge only

### PermissionGate
**`components/PermissionGate.js`**
- Blocks entry until camera + full-screen share + mic granted
- Validates `settings.displaySurface === 'monitor'` (rejects window/tab)
- Live monitoring only — nothing recorded or stored
- Screen share stopped mid-interview → red banner "company has been notified"

### InterviewExperience.js
- Phases: `intake → chat → finishing → report`
- `prefilledCandidate` prop → skips intake form
- `friendlyError()` — converts raw API/429 errors to user-friendly strings
- `primeInterview()` → `/api/interview/prime` to pre-analyze JD+resume

---

## Database (Supabase PostgreSQL) — current state

```sql
interview_jobs         -- company job postings (id, title, role, description, slug, user_id, is_active)
interview_candidates   -- candidate results (id, job_id, name, email, transcript JSONB, report JSONB, score)
interview_sessions     -- live session state (id, job_id, candidate_id, status, messages JSONB, primed_context JSONB)
user_profiles          -- candidate profiles (user_id, name, email, resume_text)
company_profiles       -- company accounts
```

⚠️ **Report stored as JSONB** — refactor to structured `candidate_scores` tied to `competency_frameworks` per Part 7.

`lib/db.js` exports `query(sql, params)` — uses `DATABASE_URL` pooler connection.

---

## Routes

| Route | Auth | Description |
|---|---|---|
| `/interview/[slug]` | ✅ | Candidate takes interview via company link |
| `/jobs/[id]/interview` | ✅ | Direct job interview |
| `/company/jobs` | ✅ | Company job management |
| `/company/jobs/[id]` | ✅ | Job detail + candidate list |
| `/company/candidates` | ✅ | All candidates across jobs |
| `/dashboard/domain-expert` | ✅ | Maya expertise assessment |
| `/api/interview` | ✅ | AI question/report generation |
| `/api/interview/prime` | ✅ | JD+resume pre-analysis |
| `/api/tts` | public | TTS audio generation |
| `/api/stt` | public | Whisper transcription |
| `/api/jobs/by-slug/[slug]` | public | Job lookup for interview page |

---

## Known Issues / Immediate Cleanup

### Cleanup Required
1. **Delete temp test page:** `app/dev-interview-test/page.js` — created for headless testing
2. **Revert middleware bypass:** `lib/supabase/middleware.js` — remove `DEV_BYPASS` constant + bypass check

### VoiceChat Known Limitations
- Web Speech API only works in Chrome/Edge (Safari not supported)
- `primeTTS()` called from `PermissionGate` "Begin Interview" click — real user gesture, so AudioContext unlocks cleanly
- If AudioContext gets blocked → "▶ Tap to hear Iris" recovery button

### Rate Limits
Both Gemini keys are free tier (20 req/min). Groq fallback kicks in on 429. Groq streaming for questions is NOT implemented — falls back to non-streaming JSON, losing the word-by-word effect.

---

## Domain Expert Mode (Maya)

Separate 7-question expertise validation flow. `assessmentType: 'domain_expert'` on API calls.
- Persona: `domainExpertPersona()` — Maya, 8 years assessing consultants/freelancers
- Question phases: foundation → breadth → depth → edge cases → close
- Report: `expertise_score`, `expertise_level` (beginner→master), `domain_areas`, `depth_evidence`, `unique_value`, `recommended_use_cases`, `knowledge_gaps`, `standout_moment`, `credibility_signals`, `internal_scores`
- UI: `components/DomainExpertExperience.js` at `app/dashboard/domain-expert/page.js`

---

## Session-Specific Rules

- **Never commit or push to main** on any EliteTechlogix repo — always via PR from feature branch
- Session isolation: user runs multiple terminals for different tasks; never mix context between them
- Auto-memory system active — write memories to `/Users/ahmadabdullah/.claude/projects/-Users-ahmadabdullah/memory/`
