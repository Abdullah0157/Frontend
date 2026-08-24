// Adds the profile_prefs JSONB column that backs the Location / Availability /
// Work preferences / Communications profile tabs. Additive and idempotent —
// safe to run more than once, touches no existing data.
//
// Run:  cd ~/jobstream-frontend && node --env-file=.env.local scripts/add-profile-prefs.mjs
import pg from 'pg'

const url = process.env.DATABASE_URL
if (!url) { console.error('NO DATABASE_URL'); process.exit(1) }

const c = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } })
await c.connect()

await c.query(`ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS profile_prefs jsonb`)
console.log('✓ user_profiles.profile_prefs ready')

const { rows } = await c.query(
  `select column_name, data_type from information_schema.columns
   where table_name='user_profiles' and column_name='profile_prefs'`
)
console.log('  verified:', rows[0] || 'MISSING')
await c.end()
