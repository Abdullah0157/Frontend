import { readFileSync } from 'node:fs'
import pg from 'pg'
const env = readFileSync(new URL("../.env.local", import.meta.url), 'utf8')
for (const line of env.split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.+?)\s*$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2]
}
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } })
const r = await pool.query(`
  SELECT
    au.email,
    au.raw_user_meta_data->>'account_type' AS jwt_account_type,
    up.account_type AS profile_account_type
  FROM auth.users au
  LEFT JOIN user_profiles up ON up.user_id = au.id
  WHERE lower(au.email) = 'ahmadabdullahmac@gmail.com'
`)
console.log(JSON.stringify(r.rows, null, 2))
await pool.end()
