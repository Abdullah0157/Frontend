import { NextResponse } from 'next/server'
import { getSupabaseServer } from '@/lib/supabase/server'
import { query } from '@/lib/db'

export const dynamic = 'force-dynamic'

// Returns a candidate's persistent skill graph (theta per skill, joined to
// skill labels/domains) plus a recent evidence trail. Anonymous callers get
// an empty-but-200 response so the page can render a friendly logged-out
// state without special-casing a 401.
export async function GET(request) {
  const supabase = getSupabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ skills: [], evidence: [] }, { status: 200 })
  }

  let targetUserId = user.id

  const { searchParams } = new URL(request.url)
  const requestedUserId = searchParams.get('userId')
  if (requestedUserId && requestedUserId !== user.id) {
    try {
      const { rows } = await query(
        `SELECT account_type FROM user_profiles WHERE user_id = $1`,
        [user.id]
      )
      if (rows[0]?.account_type === 'super_admin') {
        targetUserId = requestedUserId
      }
      // Non-super_admins requesting someone else's graph silently fall back
      // to their own — no error, just ignore the param.
    } catch {
      // ignore — fall back to own id
    }
  }

  let skills = []
  let evidence = []

  try {
    const { rows } = await query(
      `SELECT css.skill_code, s.label, s.domain, s.subdomain,
              css.theta, css.theta_se, css.confidence, css.n_responses, css.last_updated_at
       FROM candidate_skill_state css
       JOIN skills s ON s.code = css.skill_code
       WHERE css.candidate_user_id = $1
       ORDER BY s.domain, s.subdomain, s.label`,
      [targetUserId]
    )
    skills = rows
  } catch {
    skills = []
  }

  try {
    const { rows } = await query(
      `SELECT cse.skill_code, s.label, cse.evidence_type, cse.quote, cse.ai_reasoning, cse.created_at
       FROM candidate_skill_evidence cse
       JOIN skills s ON s.code = cse.skill_code
       WHERE cse.candidate_user_id = $1
       ORDER BY cse.created_at DESC
       LIMIT 30`,
      [targetUserId]
    )
    evidence = rows
  } catch {
    evidence = []
  }

  return NextResponse.json({ skills, evidence })
}
