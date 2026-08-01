import { NextResponse } from 'next/server'
import { getSupabaseServer } from '@/lib/supabase/server'
import { query } from '@/lib/db'
import { logEvent, pickNextItem } from '@/lib/assessment'

export const dynamic = 'force-dynamic'

// POST /api/assessment/start
// Body: { roleFamily, seniorityBand, targetSkillCodes?[], timeLimitS? }
// Creates a session, logs SessionStarted, picks + returns the first item.
export async function POST(req) {
  const body = await req.json().catch(() => ({}))
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
            rubric: firstItem.type === 'mcq' ? firstItem.scoring_rubric : null,
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
