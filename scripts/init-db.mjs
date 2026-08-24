import { readFileSync } from 'node:fs'
import pg from 'pg'

// Load .env.local manually (no dotenv dep)
try {
  const env = readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
  for (const line of env.split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.+?)\s*$/)
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2]
  }
} catch {}

const { Pool } = pg

const SCHEMA = `
CREATE TABLE IF NOT EXISTS interview_jobs (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug            text UNIQUE NOT NULL,
  title           text NOT NULL,
  role            text NOT NULL,
  description     text NOT NULL,
  external_job_id text UNIQUE,
  company         text,
  created_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE interview_jobs ADD COLUMN IF NOT EXISTS external_job_id text;
ALTER TABLE interview_jobs ADD COLUMN IF NOT EXISTS company text;
CREATE UNIQUE INDEX IF NOT EXISTS idx_jobs_external_id ON interview_jobs(external_job_id) WHERE external_job_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS interview_candidates (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id         uuid NOT NULL REFERENCES interview_jobs(id) ON DELETE CASCADE,
  name           text NOT NULL,
  email          text,
  transcript     jsonb NOT NULL,
  report         jsonb,
  job_fit_score  integer,
  fit_reasoning  text,
  resume_text    text,
  decision       text NOT NULL DEFAULT 'pending',
  created_at     timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE interview_candidates ADD COLUMN IF NOT EXISTS resume_text text;
ALTER TABLE interview_candidates ADD COLUMN IF NOT EXISTS decision text NOT NULL DEFAULT 'pending';
ALTER TABLE interview_candidates ADD COLUMN IF NOT EXISTS user_id uuid;

CREATE INDEX IF NOT EXISTS idx_candidates_job_id ON interview_candidates(job_id);
CREATE INDEX IF NOT EXISTS idx_candidates_fit_score ON interview_candidates(job_id, job_fit_score DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_candidates_user_id ON interview_candidates(user_id);

-- User profile (one row per Supabase Auth user). Holds shared identity (name,
-- account_type). Candidate-specific data (resume) is stored on this row.
-- Company-specific data lives in company_profiles.
CREATE TABLE IF NOT EXISTS user_profiles (
  user_id            uuid PRIMARY KEY,
  full_name          text,
  account_type       text NOT NULL DEFAULT 'candidate',
  resume_text        text,
  resume_filename    text,
  resume_pages       integer,
  resume_chars       integer,
  resume_uploaded_at timestamptz,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS account_type text NOT NULL DEFAULT 'candidate';
-- Backs the Location / Availability / Work preferences / Communications tabs.
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS profile_prefs jsonb;

-- Company-side profile (one row per company user).
CREATE TABLE IF NOT EXISTS company_profiles (
  user_id        uuid PRIMARY KEY,
  company_name   text NOT NULL,
  website        text,
  industry       text,
  description    text,
  logo_url       text,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE company_profiles ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='company_profiles' AND policyname='own company read') THEN
    CREATE POLICY "own company read" ON company_profiles FOR SELECT USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='company_profiles' AND policyname='own company write') THEN
    CREATE POLICY "own company write" ON company_profiles FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- Multi-tenant: which company owns each interview_jobs row.
ALTER TABLE interview_jobs ADD COLUMN IF NOT EXISTS owner_id uuid;
CREATE INDEX IF NOT EXISTS idx_jobs_owner_id ON interview_jobs(owner_id);

-- RLS: a user can read/write only their own profile row.
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='user_profiles' AND policyname='own profile read') THEN
    CREATE POLICY "own profile read" ON user_profiles FOR SELECT
      USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='user_profiles' AND policyname='own profile upsert') THEN
    CREATE POLICY "own profile upsert" ON user_profiles FOR INSERT
      WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='user_profiles' AND policyname='own profile update') THEN
    CREATE POLICY "own profile update" ON user_profiles FOR UPDATE
      USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- Persistent interview sessions
CREATE TABLE IF NOT EXISTS interview_sessions (
  id              uuid PRIMARY KEY,
  job_id          uuid REFERENCES interview_jobs(id) ON DELETE CASCADE,
  messages        jsonb NOT NULL DEFAULT '[]',
  primed_context  jsonb,
  total_questions integer NOT NULL DEFAULT 5,
  status          text NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress','completed','abandoned')),
  started_at      timestamptz NOT NULL DEFAULT now(),
  completed_at    timestamptz,
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sessions_job_id ON interview_sessions(job_id);

-- SaaS usage tracking per company per month
CREATE TABLE IF NOT EXISTS company_usage (
  id                    serial PRIMARY KEY,
  company_id            uuid REFERENCES user_profiles(user_id) ON DELETE CASCADE,
  month                 date NOT NULL,
  interviews_completed  integer NOT NULL DEFAULT 0,
  interviews_limit      integer NOT NULL DEFAULT 25,
  plan                  text NOT NULL DEFAULT 'free' CHECK (plan IN ('free','starter','pro','enterprise')),
  UNIQUE(company_id, month)
);

ALTER TABLE interview_candidates ADD COLUMN IF NOT EXISTS session_id uuid;
ALTER TABLE interview_candidates ADD COLUMN IF NOT EXISTS duration_seconds integer;
ALTER TABLE interview_jobs ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

-- ==========================================================================
-- ASSESSMENT INTELLIGENCE LAYER (Part 11 of CLAUDE.md)
-- Item bank, per-candidate skill graph, assessment sessions.
-- ==========================================================================

-- ── Skill taxonomy ────────────────────────────────────────────────────────
-- Leaf skills that we actually measure. Codes are dotted paths like
-- 'engineering.system_design.trade_offs'. See frameworks/skills-taxonomy.yaml
-- for the authoritative source; this table is seeded from that file.
CREATE TABLE IF NOT EXISTS skills (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code        text UNIQUE NOT NULL,   -- 'engineering.programming.python'
  label       text NOT NULL,
  domain      text NOT NULL,          -- 'engineering' | 'product' | 'sales' | 'behavioral'
  subdomain   text,
  description text,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_skills_domain ON skills(domain);

-- ── Item bank ─────────────────────────────────────────────────────────────
-- Every question, coding task, scenario, or video prompt. Psychometric
-- parameters (alpha/beta/gamma) enable IRT-based adaptive testing. Fields
-- are nullable during calibration (n_administered < ~30 responses).
CREATE TABLE IF NOT EXISTS items (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  version               int NOT NULL DEFAULT 1,
  type                  text NOT NULL CHECK (type IN (
                          'mcq','coding','scenario_response',
                          'voice_response','video_response','system_design')),
  modality              text NOT NULL CHECK (modality IN ('written','voice','video','ide')),
  primary_skill_code    text NOT NULL REFERENCES skills(code) ON DELETE RESTRICT,
  secondary_skill_codes text[] DEFAULT '{}',   -- items often signal multiple skills
  prompt                text NOT NULL,          -- the question/task shown to the candidate
  reference_answer      text,                   -- rubric anchor / expected output
  scoring_rubric        jsonb,                  -- structured rubric for AI scoring
  expected_time_s       int NOT NULL DEFAULT 120,
  -- IRT parameters (nullable until calibrated)
  difficulty_beta       float,                  -- item difficulty (~-3 to +3)
  discrimination_alpha  float,                  -- how well the item discriminates
  guessing_gamma        float,                  -- floor probability of correct
  reliability_kr20      float,
  n_administered        int NOT NULL DEFAULT 0,
  tags                  text[] DEFAULT '{}',
  content_hash          text,                   -- SHA-256 of prompt+reference for leak detection
  status                text NOT NULL DEFAULT 'draft'
                          CHECK (status IN ('draft','calibrating','live','retired')),
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_items_skill    ON items(primary_skill_code);
CREATE INDEX IF NOT EXISTS idx_items_status   ON items(status);
CREATE INDEX IF NOT EXISTS idx_items_type     ON items(type);

-- Historical calibration snapshots — every time we refit parameters, log it.
CREATE TABLE IF NOT EXISTS item_calibration_history (
  id                   serial PRIMARY KEY,
  item_id              uuid NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  version              int NOT NULL,
  difficulty_beta      float,
  discrimination_alpha float,
  guessing_gamma       float,
  n_at_time            int NOT NULL,
  computed_at          timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_calib_item ON item_calibration_history(item_id, computed_at DESC);

-- ── Assessment sessions ───────────────────────────────────────────────────
-- A live run of an assessment. State + event log per CLAUDE.md Part 6.
CREATE TABLE IF NOT EXISTS assessment_sessions (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_user_id   uuid,                     -- may be null for anonymous / dev test runs
  role_family         text NOT NULL,            -- 'swe-backend' | 'pm-consumer' | 'sales-ae' | ...
  seniority_band      text,                     -- 'L3' | 'L4' | 'L5' | ...
  framework_version   text NOT NULL,            -- versioned; enables re-scoring later
  target_skill_codes  text[] DEFAULT '{}',      -- which skills this session probes
  state               text NOT NULL DEFAULT 'in_progress'
                        CHECK (state IN ('in_progress','submitted','completed','abandoned','flagged')),
  started_at          timestamptz NOT NULL DEFAULT now(),
  completed_at        timestamptz,
  time_limit_s        int NOT NULL DEFAULT 1800,
  proctoring_config   jsonb,
  final_report_id     uuid,
  metadata            jsonb                     -- misc: device, referral, etc.
);
CREATE INDEX IF NOT EXISTS idx_sessions_candidate ON assessment_sessions(candidate_user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_state     ON assessment_sessions(state);

-- Append-only event log for each session (per Part 6).
CREATE TABLE IF NOT EXISTS assessment_events (
  id            serial PRIMARY KEY,
  session_id    uuid NOT NULL REFERENCES assessment_sessions(id) ON DELETE CASCADE,
  seq           int NOT NULL,
  type          text NOT NULL,                  -- 'session_started','item_shown','response_received', etc.
  payload       jsonb NOT NULL,
  actor         text,                            -- 'candidate' | 'scorer:v2' | 'proctor' | 'system'
  ts            timestamptz NOT NULL DEFAULT now(),
  UNIQUE (session_id, seq)
);
CREATE INDEX IF NOT EXISTS idx_events_session ON assessment_events(session_id, seq);

-- Each response to an item within a session.
CREATE TABLE IF NOT EXISTS item_responses (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id        uuid NOT NULL REFERENCES assessment_sessions(id) ON DELETE CASCADE,
  item_id           uuid NOT NULL REFERENCES items(id) ON DELETE RESTRICT,
  candidate_user_id uuid,
  seq               int NOT NULL,                 -- order within the session
  raw_response      jsonb NOT NULL,               -- text | code | audio_ref | video_ref
  score             float,                        -- 0..1 normalized
  score_confidence  float,                        -- 0..1
  ai_evaluation     jsonb,                        -- structured evaluation with evidence refs
  human_review      jsonb,                        -- populated during calibration studies
  time_spent_ms     int,
  created_at        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_responses_session ON item_responses(session_id, seq);
CREATE INDEX IF NOT EXISTS idx_responses_item    ON item_responses(item_id);

-- ── Persistent Skill Graph (per candidate) ────────────────────────────────
-- The heart of the platform. Every assessment updates this. Never truncated.
-- theta = IRT ability estimate (-3..+3 typical); theta_se = uncertainty.
CREATE TABLE IF NOT EXISTS candidate_skill_state (
  candidate_user_id uuid NOT NULL,
  skill_code        text NOT NULL REFERENCES skills(code) ON DELETE CASCADE,
  theta             float NOT NULL DEFAULT 0,     -- prior mean = 0 (population average)
  theta_se          float NOT NULL DEFAULT 1.5,   -- prior uncertainty (wide)
  confidence        float NOT NULL DEFAULT 0,     -- derived: shrinks as SE narrows and n grows
  n_responses       int NOT NULL DEFAULT 0,
  last_updated_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (candidate_user_id, skill_code)
);
CREATE INDEX IF NOT EXISTS idx_cskill_candidate ON candidate_skill_state(candidate_user_id);

-- Every response that updated a skill leaves an evidence row here.
-- This is what makes the skill graph auditable ("why does the system think
-- you're strong at consistency models?" → here's the specific response).
CREATE TABLE IF NOT EXISTS candidate_skill_evidence (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_user_id uuid NOT NULL,
  skill_code        text NOT NULL REFERENCES skills(code) ON DELETE CASCADE,
  item_response_id  uuid NOT NULL REFERENCES item_responses(id) ON DELETE CASCADE,
  evidence_type     text NOT NULL CHECK (evidence_type IN
                      ('demonstrated','contradicted','partial')),
  evidence_weight   float NOT NULL DEFAULT 1.0,   -- how much this response moved theta
  quote             text,                          -- transcript/code excerpt
  ai_reasoning      text,
  created_at        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_cse_candidate_skill ON candidate_skill_evidence(candidate_user_id, skill_code);

-- Audit log of theta changes — replayable, forensic.
CREATE TABLE IF NOT EXISTS candidate_skill_transitions (
  id                  serial PRIMARY KEY,
  candidate_user_id   uuid NOT NULL,
  skill_code          text NOT NULL,
  from_theta          float,
  to_theta            float NOT NULL,
  from_theta_se       float,
  to_theta_se         float NOT NULL,
  trigger_response_id uuid REFERENCES item_responses(id) ON DELETE SET NULL,
  ts                  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_cst_candidate ON candidate_skill_transitions(candidate_user_id, ts DESC);

-- ── Assessment reports (immutable snapshots) ──────────────────────────────
CREATE TABLE IF NOT EXISTS assessment_reports (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id             uuid NOT NULL UNIQUE REFERENCES assessment_sessions(id) ON DELETE CASCADE,
  candidate_user_id      uuid,
  framework_version      text NOT NULL,
  model_versions         jsonb,                     -- {llm_scorer: 'gemini-2.5-flash', ...}
  skill_deltas           jsonb,                     -- [{skill, from_theta, to_theta, evidence_refs}]
  overall_score          float,                     -- 0..10 aggregate for hiring-manager view
  recommendation         text,                      -- 'strong_yes' | 'yes' | 'maybe' | 'no'
  summary                text,
  strengths              jsonb,                     -- Sprint 2 structured format
  concerns               jsonb,
  validation             jsonb,                     -- Sprint 2 validator output
  created_at             timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_reports_candidate ON assessment_reports(candidate_user_id, created_at DESC);

-- ==========================================================================
-- JOB REQUIREMENTS + APPLICATIONS
-- A job can require assessments (by role_family) + an AI interview. Candidates
-- must complete all required steps before their application is submitted.
-- ==========================================================================

-- Requirements attached to each job (configured by the company).
ALTER TABLE interview_jobs ADD COLUMN IF NOT EXISTS required_assessments text[] NOT NULL DEFAULT '{}';
ALTER TABLE interview_jobs ADD COLUMN IF NOT EXISTS requires_ai_interview boolean NOT NULL DEFAULT true;

-- Tie an assessment session to a job so a completed assessment counts toward
-- that job's application (null = standalone practice assessment).
ALTER TABLE assessment_sessions ADD COLUMN IF NOT EXISTS job_id uuid;
CREATE INDEX IF NOT EXISTS idx_asessions_job ON assessment_sessions(job_id, candidate_user_id);

-- One application per (job, candidate). status advances in_progress → submitted.
CREATE TABLE IF NOT EXISTS job_applications (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id            uuid NOT NULL REFERENCES interview_jobs(id) ON DELETE CASCADE,
  candidate_user_id uuid NOT NULL,
  status            text NOT NULL DEFAULT 'in_progress'
                      CHECK (status IN ('in_progress','submitted','withdrawn')),
  created_at        timestamptz NOT NULL DEFAULT now(),
  submitted_at      timestamptz,
  UNIQUE (job_id, candidate_user_id)
);
CREATE INDEX IF NOT EXISTS idx_applications_job ON job_applications(job_id);
CREATE INDEX IF NOT EXISTS idx_applications_candidate ON job_applications(candidate_user_id);

-- ==========================================================================
-- EXPERT ASSESSMENTS (Domain Expert voice interviews with Maya)
-- Persists the transcript + rubric report so candidates can review them and
-- admins can audit them. Not job-scoped (unlike interview_candidates).
-- ==========================================================================
CREATE TABLE IF NOT EXISTS expert_assessments (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_user_id uuid,
  domain            text,
  transcript        jsonb NOT NULL DEFAULT '[]',
  report            jsonb,
  expertise_score   numeric,
  expertise_level   text,
  created_at        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_expert_candidate ON expert_assessments(candidate_user_id, created_at DESC);
`

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
})

try {
  await pool.query(SCHEMA)
  console.log('✓ Schema applied')
  const r = await pool.query(
    `SELECT table_name FROM information_schema.tables
     WHERE table_name IN (
       'interview_jobs','interview_candidates','interview_sessions','company_usage',
       'skills','items','item_calibration_history','assessment_sessions','assessment_events',
       'item_responses','candidate_skill_state','candidate_skill_evidence',
       'candidate_skill_transitions','assessment_reports')
     ORDER BY table_name`
  )
  console.log('Tables present:', r.rows.map((row) => row.table_name).join(', '))
} catch (e) {
  console.error('Schema init failed:', e.message)
  process.exitCode = 1
} finally {
  await pool.end()
}
