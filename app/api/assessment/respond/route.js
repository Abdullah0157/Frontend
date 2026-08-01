import { NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { logEvent, pickNextItem, scoreResponse, updateSkillGraph, shouldStop, generateReport } from '@/lib/assessment'

export const dynamic = 'force-dynamic'

// POST /api/assessment/respond
// Body: { sessionId, itemId, response: { text? | code? | choice_index? }, timeSpentMs }
//
// Scores the response, updates the candidate's skill graph, picks the next
// item (or ends the session). Returns the next item or a completion payload.
export async function POST(req) {
  const body = await req.json().catch(() => ({}))
  const { sessionId, itemId, response: rawResponse, timeSpentMs } = body

  if (!sessionId || !itemId) {
    return NextResponse.json({ error: 'sessionId and itemId required' }, { status: 400 })
  }

  try {
    // 1. Load the item + session (for candidate_user_id and state check).
    const { rows: itemRows } = await query(
      `SELECT id, type, modality, primary_skill_code, secondary_skill_codes,
              scoring_rubric, expected_time_s, reference_answer
       FROM items WHERE id = $1`,
      [itemId]
    )
    if (itemRows.length === 0) return NextResponse.json({ error: 'item not found' }, { status: 404 })
    const item = itemRows[0]

    const { rows: sessRows } = await query(
      `SELECT candidate_user_id, state FROM assessment_sessions WHERE id = $1`,
      [sessionId]
    )
    if (sessRows.length === 0) return NextResponse.json({ error: 'session not found' }, { status: 404 })
    if (sessRows[0].state !== 'in_progress') {
      return NextResponse.json({ error: 'session not in progress' }, { status: 400 })
    }
    const candidateUserId = sessRows[0].candidate_user_id

    // 2. Score the response.
    const scored = await scoreResponse(item, rawResponse || {})

    // 3. Persist the item_response.
    const { rows: nextSeqRows } = await query(
      `SELECT COALESCE(MAX(seq), 0) + 1 AS next FROM item_responses WHERE session_id = $1`,
      [sessionId]
    )
    const seq = nextSeqRows[0].next
    const { rows: respRows } = await query(
      `INSERT INTO item_responses
         (session_id, item_id, candidate_user_id, seq, raw_response,
          score, score_confidence, ai_evaluation, time_spent_ms)
       VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7, $8::jsonb, $9)
       RETURNING id, score, score_confidence`,
      [
        sessionId, itemId, candidateUserId, seq,
        JSON.stringify(rawResponse || {}),
        scored.score, scored.score_confidence,
        JSON.stringify(scored.ai_evaluation || {}),
        timeSpentMs || null,
      ]
    )
    const responseRow = { id: respRows[0].id, ...respRows[0], raw_response: rawResponse, ai_evaluation: scored.ai_evaluation }

    await logEvent(sessionId, 'response_received', {
      itemId, seq, score: scored.score, confidence: scored.score_confidence,
    }, 'candidate')

    // 4. Update the persistent skill graph (only for scored responses).
    if (scored.score != null) {
      await updateSkillGraph(candidateUserId, item, responseRow)
      await logEvent(sessionId, 'skill_graph_updated', {
        responseId: responseRow.id,
        skills: [item.primary_skill_code, ...(item.secondary_skill_codes || [])],
      }, 'system')
    }

    // 5. Update items.n_administered counter.
    await query(`UPDATE items SET n_administered = n_administered + 1 WHERE id = $1`, [itemId])

    // 6. Should we stop?
    const stop = await shouldStop(sessionId)
    if (stop.stop) {
      await query(
        `UPDATE assessment_sessions SET state = 'submitted', completed_at = now() WHERE id = $1`,
        [sessionId]
      )
      await logEvent(sessionId, 'session_completed', { reason: stop.reason }, 'system')

      // Generate the final report. A report failure must never break the
      // respond response — the session is already marked submitted.
      let report = null
      try {
        report = await generateReport(sessionId)
        await logEvent(sessionId, 'report_generated', { reportId: report.reportId, overallScore: report.overallScore }, 'system')
      } catch (repErr) {
        console.error('generateReport failed:', repErr)
        await logEvent(sessionId, 'report_failed', { error: repErr.message }, 'system').catch(() => {})
      }

      return NextResponse.json({
        status: 'completed',
        reason: stop.reason,
        sessionId,
        reportId: report?.reportId || null,
        overallScore: report?.overallScore ?? null,
        recommendation: report?.recommendation || null,
        // Frontend can now GET /api/assessment/[id] for the full state + report.
      })
    }

    // 7. Otherwise pick the next item.
    const nextItem = await pickNextItem(sessionId)
    if (!nextItem) {
      await query(
        `UPDATE assessment_sessions SET state = 'submitted', completed_at = now() WHERE id = $1`,
        [sessionId]
      )
      await logEvent(sessionId, 'session_completed', { reason: 'no_more_items' }, 'system')

      let report = null
      try {
        report = await generateReport(sessionId)
        await logEvent(sessionId, 'report_generated', { reportId: report.reportId, overallScore: report.overallScore }, 'system')
      } catch (repErr) {
        console.error('generateReport failed:', repErr)
        await logEvent(sessionId, 'report_failed', { error: repErr.message }, 'system').catch(() => {})
      }

      return NextResponse.json({
        status: 'completed',
        reason: 'no_more_items',
        sessionId,
        reportId: report?.reportId || null,
        overallScore: report?.overallScore ?? null,
        recommendation: report?.recommendation || null,
      })
    }
    await logEvent(sessionId, 'item_shown', { itemId: nextItem.id, type: nextItem.type }, 'system')

    return NextResponse.json({
      status: 'in_progress',
      lastScore: scored.score,
      lastScoreConfidence: scored.score_confidence,
      item: {
        id: nextItem.id,
        type: nextItem.type,
        modality: nextItem.modality,
        prompt: nextItem.prompt,
        rubric: nextItem.type === 'mcq' ? nextItem.scoring_rubric : null,
        expectedTimeS: nextItem.expected_time_s,
      },
    })
  } catch (e) {
    console.error('assessment/respond error:', e)
    return NextResponse.json({ error: e.message || 'Failed to record response' }, { status: 500 })
  }
}
