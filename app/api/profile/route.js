import { NextResponse } from 'next/server'
import { getSupabaseServer } from '@/lib/supabase/server'
import { query } from '@/lib/db'

export const dynamic = 'force-dynamic'

async function getUserOrFail() {
  const supabase = getSupabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  return user
}

export async function GET() {
  const user = await getUserOrFail()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const { rows } = await query(
    `SELECT user_id, full_name, resume_filename, resume_pages, resume_chars,
            resume_uploaded_at,
            (resume_text IS NOT NULL) AS has_resume
     FROM user_profiles WHERE user_id = $1`,
    [user.id]
  )
  return NextResponse.json({
    user: { id: user.id, email: user.email },
    profile: rows[0] || null,
  })
}

export async function PUT(req) {
  const user = await getUserOrFail()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const { full_name, resume_text, resume_filename, resume_pages, resume_chars } = body

  await query(
    `INSERT INTO user_profiles (user_id, full_name, resume_text, resume_filename, resume_pages, resume_chars, resume_uploaded_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, now())
     ON CONFLICT (user_id) DO UPDATE SET
       full_name = COALESCE(EXCLUDED.full_name, user_profiles.full_name),
       resume_text = COALESCE(EXCLUDED.resume_text, user_profiles.resume_text),
       resume_filename = COALESCE(EXCLUDED.resume_filename, user_profiles.resume_filename),
       resume_pages = COALESCE(EXCLUDED.resume_pages, user_profiles.resume_pages),
       resume_chars = COALESCE(EXCLUDED.resume_chars, user_profiles.resume_chars),
       resume_uploaded_at = CASE WHEN EXCLUDED.resume_text IS NOT NULL THEN now() ELSE user_profiles.resume_uploaded_at END,
       updated_at = now()`,
    [
      user.id,
      full_name || null,
      resume_text || null,
      resume_filename || null,
      resume_pages || null,
      resume_chars || null,
      resume_text ? new Date().toISOString() : null,
    ]
  )
  return NextResponse.json({ ok: true })
}

// Returns the full resume text for the logged-in user (used by interview page)
export async function POST() {
  const user = await getUserOrFail()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  const { rows } = await query(
    `SELECT resume_text, full_name FROM user_profiles WHERE user_id = $1`,
    [user.id]
  )
  return NextResponse.json({
    resume_text: rows[0]?.resume_text || null,
    full_name: rows[0]?.full_name || null,
  })
}
