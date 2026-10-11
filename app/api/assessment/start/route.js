import { NextResponse } from 'next/server'
import { getSupabaseServer } from '@/lib/supabase/server'
import { query } from '@/lib/db'
import { logEvent, pickNextItem } from '@/lib/assessment'
import { createSession, getState, startOptions, loadSession } from '@/lib/written-assessment'
import { trackFromRoleFamily } from '@/lib/assessment-blueprint'
import { currentUser, errorResponse } from '@/lib/written-api'

export const dynamic = 'force-dynamic'

// GET /api/assessment/start[?track=&level=] -> families, tracks, levels and
// coding languages on offer, plus a preview of that test's sections.
export async function GET(req) {
  const url = new URL(req.url)
  return NextResponse.json(startOptions({ track: url.searchParams.get('track'), level: url.searchParams.get('level') }))
}

// Written assessment (sectioned, timed, per-candidate form).
// Body: { track, level, language, jobId?, disabledSections? }
// Returns the session id, its access token (shown once) and the first
// section intro. The candidate calls /api/assessment/[id]/begin to start it.
async function startWritten(req, body) {
  try {
    const { user } = await currentUser()
    const track = body.track || trackFromRoleFamily(body.roleFamily)
    const { sessionId, token, resumed } = await createSession({
      candidateUserId: user?.id || null,
      track,
      level: body.level || body.seniorityBand,
      language: body.language,
      jobId: body.jobId || null,
      disabledSections: Array.isArray(body.disabledSections) ? body.disabledSections : [],
      options: body.options && typeof body.options === 'object' ? body.options : {},
      userAgent: req.headers.get('user-agent'),
    })
    const state = await getState(await loadSession(sessionId))
    return NextResponse.json({ sessionId, token, resumed: Boolean(resumed), ...state })
  } catch (e) {
    return errorResponse(e, 'assessment/start')
  }
}

// POST /api/assessment/start
// Body: { roleFamily, seniorityBand, targetSkillCodes?[], timeLimitS? }
// Creates a session, logs SessionStarted, picks + returns the first item.
export async function POST(req) {
  const body = await req.json().catch(() => ({}))
  if (body.mode === 'written' || body.track) return startWritten(req, body)
  const roleFamily     = body.roleFamily     || 'swe-backend'
  const seniorityBand  = body.seniorityBand  || 'L4'
  const targetSkills   = Array.isArray(body.targetSkillCodes) ? body.targetSkillCodes : []
  const timeLimitS     = Number.isInteger(body.timeLimitS) ? body.timeLimitS : 1800
  const frameworkVer   = body.frameworkVersion || 'swe-backend-v1.0.0-draft'
  const jobId          = body.jobId || null  // ties this assessment to a job application

  // Get user if logged in (assessment supports anonymous dev runs too).
  const supabase = getSupabaseServer()
  const { data: { user } } = await supabase.auth.getUser().catch(() => ({ data: { user: null } }))
  const candidateUserId = user?.id || null

  try {
    const { rows: sessRows } = await query(
      `INSERT INTO assessment_sessions
         (candidate_user_id, role_family, seniority_band, framework_version,
          target_skill_codes, time_limit_s, job_id, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)
       RETURNING id, started_at`,
      [
        candidateUserId, roleFamily, seniorityBand, frameworkVer,
        targetSkills, timeLimitS, jobId,
        JSON.stringify({ userAgent: req.headers.get('user-agent') || null }),
      ]
    )
    const sessionId = sessRows[0].id

    await logEvent(sessionId, 'session_started', {
      candidateUserId, roleFamily, seniorityBand, frameworkVer, targetSkills,
    }, 'system')

    const firstItem = await pickNextItem(sessionId)
    if (firstItem) {
      await logEvent(sessionId, 'item_shown', { itemId: firstItem.id, type: firstItem.type }, 'system')
    }

    return NextResponse.json({
      sessionId,
      startedAt: sessRows[0].started_at,
      item: firstItem
        ? {
            id: firstItem.id,
            type: firstItem.type,
            modality: firstItem.modality,
            prompt: firstItem.prompt,
            // Return rubric ONLY for MCQ (candidate needs to see the choices).
            // For scenario/coding, rubric stays server-side.
            // Choice text only: the correct/partial flags stay on the server.
            rubric: firstItem.type === 'mcq'
              ? { choices: (firstItem.scoring_rubric?.choices || []).map((c) => ({ text: c.text })) }
              : null,
            expectedTimeS: firstItem.expected_time_s,
          }
        : null,
      status: firstItem ? 'in_progress' : 'no_items_available',
    })
  } catch (e) {
    console.error('assessment/start error:', e)
    return NextResponse.json({ error: e.message || 'Failed to start' }, { status: 500 })
  }
}
