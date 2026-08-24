import { NextResponse } from 'next/server'
import { getSupabaseServer } from '@/lib/supabase/server'
import { query } from '@/lib/db'

export const dynamic = 'force-dynamic'

// The prefs column is added lazily on first use so a deploy never depends on a
// manual migration step. ADD COLUMN IF NOT EXISTS is idempotent and cheap, and
// we only attempt it once per server process.
let prefsColumnReady = false
async function ensurePrefsColumn() {
  if (prefsColumnReady) return
  try {
    await query(`ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS profile_prefs jsonb`)
    prefsColumnReady = true
  } catch (e) {
    console.warn('profile: could not ensure profile_prefs column:', e.message)
  }
}

async function getUserOrFail() {
  const supabase = getSupabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  return user
}

export async function GET() {
  await ensurePrefsColumn()
  const user = await getUserOrFail()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const { rows } = await query(
    `SELECT user_id, full_name, resume_filename, resume_pages, resume_chars,
            resume_uploaded_at, linkedin_url, github_url, certificates,
            resume_sections, profile_prefs, account_type,
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
  await ensurePrefsColumn()
  const user = await getUserOrFail()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const { full_name, resume_text, resume_filename, resume_pages, resume_chars, linkedin_url, github_url, certificates, resume_sections, profile_prefs } = body

  await query(
    `INSERT INTO user_profiles (user_id, full_name, resume_text, resume_filename, resume_pages, resume_chars, resume_uploaded_at, linkedin_url, github_url, certificates, resume_sections, profile_prefs, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, now())
     ON CONFLICT (user_id) DO UPDATE SET
       full_name = COALESCE(EXCLUDED.full_name, user_profiles.full_name),
       resume_text = COALESCE(EXCLUDED.resume_text, user_profiles.resume_text),
       resume_filename = COALESCE(EXCLUDED.resume_filename, user_profiles.resume_filename),
       resume_pages = COALESCE(EXCLUDED.resume_pages, user_profiles.resume_pages),
       resume_chars = COALESCE(EXCLUDED.resume_chars, user_profiles.resume_chars),
       resume_uploaded_at = CASE WHEN EXCLUDED.resume_text IS NOT NULL THEN now() ELSE user_profiles.resume_uploaded_at END,
       linkedin_url = COALESCE(EXCLUDED.linkedin_url, user_profiles.linkedin_url),
       github_url = COALESCE(EXCLUDED.github_url, user_profiles.github_url),
       certificates = COALESCE(EXCLUDED.certificates, user_profiles.certificates),
       resume_sections = COALESCE(EXCLUDED.resume_sections, user_profiles.resume_sections),
       -- MERGE prefs (top-level key per tab) so saving one tab never wipes another.
       profile_prefs = COALESCE(user_profiles.profile_prefs, '{}'::jsonb)
                       || COALESCE(EXCLUDED.profile_prefs, '{}'::jsonb),
       updated_at = now()`,
    [
      user.id,
      full_name || null,
      resume_text || null,
      resume_filename || null,
      resume_pages || null,
      resume_chars || null,
      resume_text ? new Date().toISOString() : null,
      linkedin_url || null,
      github_url || null,
      certificates ? JSON.stringify(certificates) : null,
      resume_sections ? JSON.stringify(resume_sections) : null,
      profile_prefs ? JSON.stringify(profile_prefs) : null,
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
