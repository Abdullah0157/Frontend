// Promote a user to super_admin.
// Updates BOTH:
//   1. user_profiles.account_type  → used by requireRole() in server components
//   2. auth.users.raw_user_meta_data.account_type  → used by middleware for
//      route redirects (middleware runs on Edge, can't hit user_profiles table)
// Keep them in sync or the middleware won't route them to /admin on login.

import { readFileSync } from 'node:fs'
import pg from 'pg'

const env = readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
for (const line of env.split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.+?)\s*$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2]
}

const EMAIL = process.argv[2] || 'ahmadabdullahmac@gmail.com'
const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
})

try {
  const authRes = await pool.query(
    `SELECT id, email, raw_user_meta_data FROM auth.users WHERE lower(email) = lower($1) LIMIT 1`,
    [EMAIL]
  )
  if (authRes.rowCount === 0) {
    console.log(`❌ No auth.users row for ${EMAIL}`)
    process.exit(0)
  }
  const user = authRes.rows[0]
  console.log(`✓ Found user: ${user.email} (id: ${user.id})`)
  console.log(`  Existing user_metadata: ${JSON.stringify(user.raw_user_meta_data || {})}`)

  // 1. user_profiles (server-side role checks via requireRole())
  const profRes = await pool.query(
    `SELECT account_type FROM user_profiles WHERE user_id = $1`,
    [user.id]
  )
  if (profRes.rowCount === 0) {
    await pool.query(
      `INSERT INTO user_profiles (user_id, full_name, account_type) VALUES ($1, $2, 'super_admin')`,
      [user.id, user.email.split('@')[0]]
    )
    console.log(`  user_profiles: inserted with account_type=super_admin`)
  } else {
    await pool.query(
      `UPDATE user_profiles SET account_type = 'super_admin', updated_at = now() WHERE user_id = $1`,
      [user.id]
    )
    console.log(`  user_profiles: ${profRes.rows[0].account_type} → super_admin`)
  }

  // 2. auth.users.raw_user_meta_data (middleware routing on the Edge)
  //    JSONB merge (||) preserves other metadata fields.
  await pool.query(
    `UPDATE auth.users
       SET raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || $2::jsonb
     WHERE id = $1`,
    [user.id, JSON.stringify({ account_type: 'super_admin' })]
  )
  const verify = await pool.query(
    `SELECT raw_user_meta_data->>'account_type' AS role FROM auth.users WHERE id = $1`,
    [user.id]
  )
  console.log(`  auth.users.user_metadata.account_type: ${verify.rows[0].role}`)

  console.log(`\n✅ Fully promoted. Log out and log back in — you'll be routed to /admin.`)
} catch (e) {
  console.error('❌ Failed:', e.message)
  process.exitCode = 1
} finally {
  await pool.end()
}
