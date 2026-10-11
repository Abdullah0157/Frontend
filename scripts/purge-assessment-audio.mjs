// Deletes candidate recordings older than 90 days (privacy promise in
// frameworks/english-assessment-design.md section 11). Run daily.
//   node scripts/purge-assessment-audio.mjs           # dry run
//   node scripts/purge-assessment-audio.mjs --apply   # delete
import { readFileSync } from 'node:fs'
import pg from 'pg'

try {
  for (const line of readFileSync(new URL('../.env.local', import.meta.url), 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.+?)\s*$/)
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2]
  }
} catch {}
const days = Number(process.env.AUDIO_RETENTION_DAYS) || 90
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, ssl: process.env.DATABASE_SSL === 'false' ? false : { rejectUnauthorized: false } })
try {
  const { rows } = await pool.query(`SELECT COUNT(*)::int AS n FROM assessment_audio WHERE created_at < now() - ($1 || ' days')::interval`, [days])
  console.log(`${rows[0].n} recording(s) older than ${days} days.`)
  if (process.argv.includes('--apply') && rows[0].n > 0) {
    const r = await pool.query(`DELETE FROM assessment_audio WHERE created_at < now() - ($1 || ' days')::interval`, [days])
    console.log(`Deleted ${r.rowCount}.`)
  } else if (!process.argv.includes('--apply')) {
    console.log('Dry run. Add --apply to delete.')
  }
} finally {
  await pool.end()
}
