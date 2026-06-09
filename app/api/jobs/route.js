import { NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { makeSlug } from '@/lib/slug'
import { getSupabaseServer } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

async function requireCompany() {
  const supabase = getSupabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated', status: 401 }
  const { rows } = await query(`SELECT account_type FROM user_profiles WHERE user_id = $1`, [user.id])
  if (rows[0]?.account_type !== 'company') {
    return { error: 'Company access only', status: 403 }
  }
  return { user }
}

export async function GET() {
  try {
    const auth = await requireCompany()
    if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status })

    const { rows } = await query(
      `SELECT j.id, j.slug, j.title, j.role, j.created_at,
              COUNT(c.id)::int AS candidate_count,
              MAX(c.job_fit_score) AS top_fit
       FROM interview_jobs j
       LEFT JOIN interview_candidates c ON c.job_id = j.id
       WHERE j.owner_id = $1
       GROUP BY j.id
       ORDER BY j.created_at DESC`,
      [auth.user.id]
    )
    return NextResponse.json({ jobs: rows })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function POST(req) {
  try {
    const auth = await requireCompany()
    if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status })

    const { title, role, description } = await req.json()
    if (!title?.trim() || !role?.trim() || !description?.trim()) {
      return NextResponse.json({ error: 'title, role, description are required' }, { status: 400 })
    }
    const slug = makeSlug()
    const { rows } = await query(
      `INSERT INTO interview_jobs (slug, title, role, description, owner_id)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, slug, title, role, description, created_at`,
      [slug, title.trim(), role.trim(), description.trim(), auth.user.id]
    )
    return NextResponse.json({ job: rows[0] }, { status: 201 })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
