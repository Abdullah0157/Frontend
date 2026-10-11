import { NextResponse } from 'next/server'
import { getSupabaseServer } from '@/lib/supabase/server'
import { query } from '@/lib/db'

export const dynamic = 'force-dynamic'

async function getUserOrFail() {
  const supabase = getSupabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  return user || null
}

export async function GET() {
  const user = await getUserOrFail()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  const { rows } = await query(
    `SELECT user_id, company_name, website, industry, description, logo_url, created_at
     FROM company_profiles WHERE user_id = $1`,
    [user.id]
  )
  return NextResponse.json({
    user: { id: user.id, email: user.email },
    company: rows[0] || null,
  })
}

export async function PUT(req) {
  const user = await getUserOrFail()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  const body = await req.json().catch(() => ({}))
  const { company_name, website, industry, description, logo_url } = body
  if (!company_name?.trim()) {
    return NextResponse.json({ error: 'company_name required' }, { status: 400 })
  }

  // Company accounts are invite-only: only an existing company (made one by
  // an admin) may edit its details. This used to turn any caller into a company.
  const { rows: role } = await query(`SELECT account_type FROM user_profiles WHERE user_id = $1`, [user.id])
  if (role[0]?.account_type !== 'company') {
    return NextResponse.json({ error: 'Company accounts are set up by JobStream. Please contact us.' }, { status: 403 })
  }
  await query(
    `INSERT INTO company_profiles (user_id, company_name, website, industry, description, logo_url, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, now())
     ON CONFLICT (user_id) DO UPDATE SET
       company_name = EXCLUDED.company_name,
       website = EXCLUDED.website,
       industry = EXCLUDED.industry,
       description = EXCLUDED.description,
       logo_url = EXCLUDED.logo_url,
       updated_at = now()`,
    [user.id, company_name.trim(), website?.trim() || null, industry || null, description?.trim() || null, logo_url?.trim() || null]
  )
  return NextResponse.json({ ok: true })
}
