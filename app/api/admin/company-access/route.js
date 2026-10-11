import { NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { apiUser, ROLES } from '@/lib/roles'

export const dynamic = 'force-dynamic'

// POST { email, companyName }: gives an existing account company access.
// Companies are invite-only, so this (admin only) is the one way an account
// becomes a company. The client first creates an ordinary account.
export async function POST(req) {
  const { response } = await apiUser(ROLES.SUPER_ADMIN)
  if (response) return response
  const body = await req.json().catch(() => ({}))
  const email = String(body.email || '').trim().toLowerCase()
  const companyName = String(body.companyName || '').trim().slice(0, 160)
  if (!email || !companyName) return NextResponse.json({ error: 'Email and company name are required.' }, { status: 400 })

  const { rows: users } = await query(`SELECT id FROM auth.users WHERE lower(email) = $1 LIMIT 1`, [email])
  if (!users[0]) {
    return NextResponse.json({ error: 'No JobStream account uses that email yet. Ask them to create an account at /signup, then try again.' }, { status: 404 })
  }
  const userId = users[0].id
  const { rows: current } = await query(`SELECT account_type FROM user_profiles WHERE user_id = $1`, [userId])
  if (current[0]?.account_type === ROLES.SUPER_ADMIN) {
    return NextResponse.json({ error: 'That is an admin account; it cannot be turned into a company.' }, { status: 409 })
  }
  await query(
    `INSERT INTO user_profiles (user_id, account_type) VALUES ($1, 'company')
     ON CONFLICT (user_id) DO UPDATE SET account_type = 'company', updated_at = now()`,
    [userId]
  )
  await query(
    `INSERT INTO company_profiles (user_id, company_name, updated_at) VALUES ($1, $2, now())
     ON CONFLICT (user_id) DO UPDATE SET company_name = EXCLUDED.company_name, updated_at = now()`,
    [userId, companyName]
  )
  return NextResponse.json({ ok: true })
}
