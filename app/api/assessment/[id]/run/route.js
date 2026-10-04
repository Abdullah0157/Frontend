import { NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { logEvent } from '@/lib/assessment'
import { authorizedSession, errorResponse } from '@/lib/written-api'
import { getState, AssessmentError } from '@/lib/written-assessment'
import { runTests } from '@/lib/code-runner'

export const dynamic = 'force-dynamic'

const MAX_RUNS_PER_ITEM = 30

// POST /api/assessment/[id]/run   Body: { itemId, code }
// Runs the candidate's code against the VISIBLE example tests of the current
// coding task only. Hidden tests are never run or revealed here.
export async function POST(req, { params }) {
  try {
    const { session } = await authorizedSession(req, params.id)
    const body = await req.json().catch(() => ({}))
    const state = await getState(session)
    if (state.status !== 'in_progress' || state.item?.id !== body.itemId || state.item?.type !== 'coding') {
      throw new AssessmentError('examples can only be run for the current coding task', 409, 'not_current')
    }
    const { rows } = await query(
      `SELECT COUNT(*)::int AS n FROM assessment_events
       WHERE session_id = $1 AND type = 'code_run' AND payload->>'itemId' = $2`,
      [session.id, body.itemId]
    )
    if (rows[0].n >= MAX_RUNS_PER_ITEM) {
      throw new AssessmentError(`you can run the examples up to ${MAX_RUNS_PER_ITEM} times per task`, 429, 'run_limit')
    }
    const { rows: itemRows } = await query(`SELECT content, scoring_rubric FROM items WHERE id = $1`, [body.itemId])
    const content = itemRows[0].content || {}
    const result = await runTests({
      language: session.language,
      code: String(body.code || '').slice(0, 50000),
      functionName: content.function_name,
      tests: content.visible_tests || [],
      compare: itemRows[0].scoring_rubric?.compare || 'exact',
    })
    await logEvent(session.id, 'code_run', { itemId: body.itemId, passed: result.passed, total: result.total }, 'candidate')
    return NextResponse.json({
      passed: result.passed,
      total: result.total,
      error: result.infraError ? 'The code runner is busy. Please try again in a moment.' : null,
      results: (result.results || []).map((r, i) => ({
        name: r.name,
        passed: r.passed,
        error: r.error,
        logs: r.logs,
        expected: content.visible_tests[i].calls.map((c) => c.expected),
        actual: r.actual,
      })),
    })
  } catch (e) {
    return errorResponse(e, 'assessment/run')
  }
}
