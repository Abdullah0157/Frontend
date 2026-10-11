// Creates the test accounts for hands-on QA of the logged-in areas, on a
// LOCAL Supabase stack only (it refuses any other host). Safe to rerun.
//
//   SUPABASE_URL=http://127.0.0.1:56421 SUPABASE_SERVICE_KEY=<local service key> \
//   DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:56422/postgres DATABASE_SSL=false \
//   node scripts/local-test-users.mjs
//
// The passwords below are test values for the local stack and work nowhere else.
import pg from 'pg'
import { pathToFileURL } from 'node:url'

export const TEST_USERS = [
  { email: 'company@jobstream.test', password: 'Local-test-company-26', type: 'company', name: 'Test Company Owner', company: 'Northwind Support Ltd' },
  { email: 'candidate@jobstream.test', password: 'Local-test-candidate-26', type: 'candidate', name: 'Test Candidate' },
  { email: 'admin@jobstream.test', password: 'Local-test-admin-26', type: 'super_admin', name: 'Test Admin' },
]

// Runs only when started directly, so other scripts can import TEST_USERS.
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const url = process.env.SUPABASE_URL || ''
  const key = process.env.SUPABASE_SERVICE_KEY || ''
  const dbUrl = process.env.DATABASE_URL || ''
  const local = (u) => { try { return ['127.0.0.1', 'localhost'].includes(new URL(u).hostname) } catch { return false } }
  if (!local(url) || !local(dbUrl) || !key) {
    console.error('Refusing: SUPABASE_URL and DATABASE_URL must point at this machine, and SUPABASE_SERVICE_KEY must be set.')
    process.exit(1)
  }

  const headers = { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }
  const db = new pg.Pool({ connectionString: dbUrl, ssl: false })

  for (const u of TEST_USERS) {
    let res = await fetch(`${url}/auth/v1/admin/users`, {
      method: 'POST', headers,
      body: JSON.stringify({ email: u.email, password: u.password, email_confirm: true, user_metadata: { full_name: u.name } }),
    })
    let user = await res.json()
    if (!res.ok) {
      // Already there: find it.
      const list = await (await fetch(`${url}/auth/v1/admin/users?per_page=200`, { headers })).json()
      user = (list.users || []).find((x) => x.email === u.email)
      if (!user) throw new Error(`could not create ${u.email}: ${JSON.stringify(user)}`)
    }
    await db.query(
      `INSERT INTO user_profiles (user_id, full_name, account_type) VALUES ($1, $2, $3)
       ON CONFLICT (user_id) DO UPDATE SET full_name = EXCLUDED.full_name, account_type = EXCLUDED.account_type, updated_at = now()`,
      [user.id, u.name, u.type]
    )
    if (u.company) {
      await db.query(
        `INSERT INTO company_profiles (user_id, company_name, industry, description) VALUES ($1, $2, 'Customer service', 'A test company for local QA.')
         ON CONFLICT (user_id) DO UPDATE SET company_name = EXCLUDED.company_name, updated_at = now()`,
        [user.id, u.company]
      )
    }
    console.log(`ready: ${u.email} (${u.type})`)
  }
  await db.end()
}
