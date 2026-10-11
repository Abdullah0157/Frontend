// Loads validated question banks into the `items` table (upsert by bank_key).
//
//   node scripts/seed-assessment-bank.mjs            # dry run: shows what would change
//   node scripts/seed-assessment-bank.mjs --apply    # writes
//
// Safety: refuses any database that is not on this machine unless
// --allow-remote is also given, so the live database is never changed by
// accident. Run scripts/validate-assessment-bank.mjs first; this script
// re-checks structure and refuses to load a bank with errors.

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import pg from 'pg'
import { loadBankFiles, checkBank, toItemRow } from '../lib/assessment-bank.js'
import { SKILL_ROWS } from '../lib/skill-codes.js'

try {
  const env = readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
  for (const line of env.split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.+?)\s*$/)
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2]
  }
} catch {}

const apply = process.argv.includes('--apply')
const allowRemote = process.argv.includes('--allow-remote')
const host = new URL(process.env.DATABASE_URL || 'postgres://missing').hostname
if (!['localhost', '127.0.0.1', '::1'].includes(host) && !allowRemote) {
  console.error(`Refusing to touch ${host}: not a local database. Add --allow-remote only when you mean it.`)
  process.exit(1)
}

const root = fileURLToPath(new URL('../frameworks/banks', import.meta.url))
const { items, errors: loadErrors } = loadBankFiles(root)
const errors = [...loadErrors, ...checkBank(items)]
if (errors.length) {
  for (const e of errors) console.error(`ERROR ${e}`)
  console.error(`Not seeding: ${errors.length} error(s). Run scripts/validate-assessment-bank.mjs.`)
  process.exit(1)
}

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_SSL === 'false' ? false : { rejectUnauthorized: false },
})

try {
  const { rows: existing } = await pool.query(`SELECT bank_key, content_hash FROM items WHERE bank_key IS NOT NULL`)
  const have = new Map(existing.map((r) => [r.bank_key, r.content_hash]))
  const rows = items.map(toItemRow)
  const plan = { insert: rows.filter((r) => !have.has(r.bank_key)), update: rows.filter((r) => have.has(r.bank_key) && have.get(r.bank_key) !== r.content_hash) }
  console.log(`Target: ${host}. Bank items: ${rows.length}. New: ${plan.insert.length}. Changed: ${plan.update.length}. Unchanged: ${rows.length - plan.insert.length - plan.update.length}.`)
  if (!apply) {
    console.log('Dry run. Add --apply to write.')
    process.exit(0)
  }

  for (const [code, label, domain, subdomain] of SKILL_ROWS) {
    await pool.query(
      `INSERT INTO skills (code, label, domain, subdomain) VALUES ($1, $2, $3, $4) ON CONFLICT (code) DO NOTHING`,
      [code, label, domain, subdomain]
    )
  }
  for (const r of [...plan.insert, ...plan.update]) {
    await pool.query(
      `INSERT INTO items (bank_key, type, modality, section, format, language, difficulty, tracks, levels,
         primary_skill_code, secondary_skill_codes, prompt, reference_answer, content, scoring_rubric,
         expected_time_s, difficulty_beta, discrimination_alpha, tags, content_hash, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14::jsonb,$15::jsonb,$16,$17,1.0,$18,$19,'live')
       ON CONFLICT (bank_key) WHERE bank_key IS NOT NULL DO UPDATE SET
         type = EXCLUDED.type, modality = EXCLUDED.modality, section = EXCLUDED.section,
         format = EXCLUDED.format, language = EXCLUDED.language, difficulty = EXCLUDED.difficulty,
         tracks = EXCLUDED.tracks, levels = EXCLUDED.levels, primary_skill_code = EXCLUDED.primary_skill_code,
         secondary_skill_codes = EXCLUDED.secondary_skill_codes, prompt = EXCLUDED.prompt,
         reference_answer = EXCLUDED.reference_answer, content = EXCLUDED.content,
         scoring_rubric = EXCLUDED.scoring_rubric, expected_time_s = EXCLUDED.expected_time_s,
         tags = EXCLUDED.tags, content_hash = EXCLUDED.content_hash,
         version = items.version + 1, updated_at = now()`,
      [
        r.bank_key, r.type, r.modality, r.section, r.format, r.language, r.difficulty, r.tracks, r.levels,
        r.primary_skill_code, r.secondary_skill_codes, r.prompt, r.reference_answer,
        JSON.stringify(r.content), JSON.stringify(r.scoring_rubric), r.expected_time_s, r.difficulty_beta,
        r.tags, r.content_hash,
      ]
    )
  }
  const { rows: live } = await pool.query(
    `SELECT section, type, COUNT(*)::int AS n FROM items WHERE bank_key IS NOT NULL AND status = 'live' GROUP BY 1, 2 ORDER BY 1, 2`
  )
  console.log('Live bank items now:')
  console.table(live)
} finally {
  await pool.end()
}
