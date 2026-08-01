import { NextResponse } from 'next/server'
import { query } from '@/lib/db'

export const dynamic = 'force-dynamic'

// GET /api/assessment/[id]
// Returns the session state, response history, and (for completed sessions)
// the skill-graph deltas so the frontend can render a report.
export async function GET(_req, { params }) {
  const sessionId = params.id
  if (!sessionId) return NextResponse.json({ error: 'id required' }, { status: 400 })

  try {
    const { rows: sess } = await query(
      `SELECT id, candidate_user_id, role_family, seniority_band,
              framework_version, target_skill_codes, state,
              started_at, completed_at, time_limit_s
       FROM assessment_sessions WHERE id = $1`,
      [sessionId]
    )
    if (sess.length === 0) return NextResponse.json({ error: 'session not found' }, { status: 404 })
    const session = sess[0]

    const { rows: responses } = await query(
      `SELECT ir.id, ir.seq, ir.score, ir.score_confidence, ir.time_spent_ms,
              ir.created_at, ir.raw_response, ir.ai_evaluation,
              i.type, i.modality, i.primary_skill_code, i.prompt
       FROM item_responses ir
       JOIN items i ON ir.item_id = i.id
       WHERE ir.session_id = $1
       ORDER BY ir.seq`,
      [sessionId]
    )

    // Skill deltas — pull the transitions triggered by responses in this session.
    const responseIds = responses.map((r) => r.id)
    let skillDeltas = []
    if (responseIds.length > 0) {
      const { rows: transitions } = await query(
        `SELECT skill_code, from_theta, to_theta, from_theta_se, to_theta_se, ts
         FROM candidate_skill_transitions
         WHERE trigger_response_id = ANY($1::uuid[])
         ORDER BY ts`,
        [responseIds]
      )
      skillDeltas = transitions
    }

    // Rolled-up current skill state for this candidate (across their entire
    // history, not just this session).
    let currentSkillGraph = []
    if (session.candidate_user_id) {
      const { rows: state } = await query(
        `SELECT skill_code, theta, theta_se, confidence, n_responses, last_updated_at
         FROM candidate_skill_state
         WHERE candidate_user_id = $1
         ORDER BY confidence DESC`,
        [session.candidate_user_id]
      )
      currentSkillGraph = state
    }

    // Final report (if one has been generated for this completed session).
    const { rows: reportRows } = await query(
      `SELECT id, session_id, candidate_user_id, framework_version, model_versions,
              skill_deltas, overall_score, recommendation, summary,
              strengths, concerns, validation, created_at
       FROM assessment_reports WHERE session_id = $1`,
      [sessionId]
    )
    const report = reportRows[0] || null

    return NextResponse.json({
      session,
      responses,
      skillDeltas,
      currentSkillGraph,
      report,
    })
  } catch (e) {
    console.error('assessment/[id] error:', e)
    return NextResponse.json({ error: e.message || 'Failed to load session' }, { status: 500 })
  }
}
