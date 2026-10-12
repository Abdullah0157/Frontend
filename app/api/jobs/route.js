import { NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { query } from '@/lib/db'
import { makeSlug } from '@/lib/slug'
import { getSupabaseServer } from '@/lib/supabase/server'
import { normaliseAssessmentConfig, roleFamilyFor } from '@/lib/assessment-blueprint'

export const dynamic = 'force-dynamic'

async function requireCompany() {
  const supabase = getSupabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated', status: 401 }
  const { rows } = await query(`SELECT account_type FROM user_profiles WHERE user_id = $1`, [user.id])
  // Companies are invite-only; the admin can also post jobs for a client.
  const role = rows[0]?.account_type
  if (role !== 'company' && role !== 'super_admin') {
    return { error: 'Company access only', status: 403 }
  }
  return { user, isAdmin: role === 'super_admin' }
}

export async function GET() {
  try {
    const auth = await requireCompany()
    if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status })

    // A company sees its own jobs; the admin sees every job on the site
    // (including the ones with no owner) so it can open or close them.
    // Candidates = people who started a test or the interview for the job.
    const { rows } = await query(
      `SELECT j.id, j.slug, j.title, j.role, j.created_at, j.is_active IS NOT FALSE AS is_open,
              COALESCE(NULLIF(j.company, ''), cp.company_name) AS company,
              (SELECT COUNT(DISTINCT x.u)::int FROM (
                 SELECT candidate_user_id AS u FROM assessment_sessions WHERE job_id = j.id
                 UNION SELECT user_id FROM interview_candidates WHERE job_id = j.id) x) AS candidate_count,
              (SELECT MAX(job_fit_score) FROM interview_candidates WHERE job_id = j.id) AS top_fit
       FROM interview_jobs j
       LEFT JOIN company_profiles cp ON cp.user_id = j.owner_id
       WHERE $2::boolean OR j.owner_id = $1
       ORDER BY j.is_active IS NOT FALSE DESC, j.created_at DESC`,
      [auth.user.id, auth.isAdmin]
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

    const { title, role, description, requiredAssessments, requiresAiInterview, assessmentConfig, clientCompany } = await req.json()
    if (!title?.trim() || !role?.trim() || !description?.trim()) {
      return NextResponse.json({ error: 'title, role, description are required' }, { status: 400 })
    }
    // Sanitize requirements. requiredAssessments = array of role_family codes.
    let assessments = Array.isArray(requiredAssessments)
      ? requiredAssessments.filter((a) => typeof a === 'string' && a.trim()).slice(0, 10)
      : []
    // Written test for this job (track, level, allowed languages). When set,
    // it is the job's software assessment and replaces any generic swe-* code.
    let config = null
    try {
      config = normaliseAssessmentConfig(assessmentConfig)
    } catch (e) {
      return NextResponse.json({ error: e.message }, { status: 400 })
    }
    if (config) {
      assessments = [...assessments.filter((a) => !a.startsWith('swe-') && a !== 'english'), roleFamilyFor(config.track)]
      if (config.english) assessments.push('english')
    }
    const aiInterview = requiresAiInterview !== false // default true

    const slug = makeSlug()
    const { rows } = await query(
      `INSERT INTO interview_jobs (slug, title, role, description, owner_id, required_assessments, requires_ai_interview, assessment_config, company)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9)
       RETURNING id, slug, title, role, description, required_assessments, requires_ai_interview, assessment_config, created_at`,
      [slug, title.trim(), role.trim(), description.trim(), auth.user.id, assessments, aiInterview, config ? JSON.stringify(config) : null,
        auth.isAdmin && clientCompany ? String(clientCompany).trim().slice(0, 160) || null : null]
    )
    // The public jobs page is cached for a minute; show the new job right away.
    revalidatePath('/jobs')
    return NextResponse.json({ job: rows[0] }, { status: 201 })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
