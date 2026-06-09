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
`

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
})

try {
  await pool.query(SCHEMA)
  console.log('✓ Schema applied')
  const r = await pool.query(
    `SELECT table_name FROM information_schema.tables WHERE table_name IN ('interview_jobs','interview_candidates')`
  )
  console.log('Tables present:', r.rows.map((row) => row.table_name).join(', '))
} catch (e) {
  console.error('Schema init failed:', e.message)
  process.exitCode = 1
} finally {
  await pool.end()
}
