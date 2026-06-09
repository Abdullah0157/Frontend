import { NextResponse } from 'next/server'
import { getSupabaseServer } from '@/lib/supabase/server'
import { query } from '@/lib/db'

export const dynamic = 'force-dynamic'

// Returns the current user's role so the client can render role-specific UI
// without exposing protected endpoints to redirect through.
export async function GET() {
  const supabase = getSupabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ user: null }, { status: 200 })

  let accountType = 'candidate'
  let companyName = null
  try {
    const { rows } = await query(
      `SELECT up.account_type, cp.company_name
       FROM user_profiles up
       LEFT JOIN company_profiles cp ON cp.user_id = up.user_id
       WHERE up.user_id = $1`,
      [user.id]
    )
    accountType = rows[0]?.account_type || 'candidate'
    companyName = rows[0]?.company_name || null
  } catch {}

  return NextResponse.json({
    user: { id: user.id, email: user.email },
    accountType,
    companyName,
  })
}
