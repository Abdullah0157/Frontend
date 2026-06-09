import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
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

  // Promote user to company role + write company_profiles in one txn-ish.
  await query(
    `INSERT INTO user_profiles (user_id, account_type)
     VALUES ($1, 'company')
     ON CONFLICT (user_id) DO UPDATE SET account_type = 'company', updated_at = now()`,
    [user.id]
  )
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

// Promote-from-cookie: called by /auth/callback after first email verification.
// Reads the `pending_company` cookie set during signup and persists it.
export async function POST() {
  const user = await getUserOrFail()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  const cookieStore = cookies()
  const raw = cookieStore.get('pending_company')?.value
  if (!raw) return NextResponse.json({ ok: false, reason: 'no pending company data' })
  let data
  try { data = JSON.parse(decodeURIComponent(raw)) } catch {
    return NextResponse.json({ ok: false, reason: 'bad cookie' })
  }
  if (!data?.company_name) return NextResponse.json({ ok: false, reason: 'missing company_name' })

  await query(
    `INSERT INTO user_profiles (user_id, account_type)
     VALUES ($1, 'company')
     ON CONFLICT (user_id) DO UPDATE SET account_type = 'company', updated_at = now()`,
    [user.id]
  )
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
    [user.id, data.company_name, data.website || null, data.industry || null, data.description || null, data.logo_url || null]
  )
  return NextResponse.json({ ok: true })
}
