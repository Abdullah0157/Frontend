import { NextResponse } from 'next/server'
import { getSupabaseServer } from '@/lib/supabase/server'
import { query } from '@/lib/db'
import { finalizeReport } from '@/lib/expert-rubric'
import { scoreTranscriptEnsemble } from '@/lib/eie-rate'

export const dynamic = 'force-dynamic'

// POST /api/interview/save-expert-report
// Body: { domain, transcript, report }
// Persists a completed Domain Expert (Maya) interview for the logged-in user
// so they can review the rubric later and admins can audit it.
export async function POST(req) {
  const supabase = getSupabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const { domain, transcript, report: rawReport, evasions = 0 } = await req.json().catch(() => ({}))
  if (!rawReport) return NextResponse.json({ error: 'report required' }, { status: 400 })
  // Recompute the deterministic score/level here too, so a report stored via
  // this path can never disagree with the rubric engine.
  const report = finalizeReport(rawReport)

  // Enrich with the EIE competency profile (Phase 1). Non-fatal: if the rater
  // call fails, we still store the base report.
  if (Array.isArray(transcript) && transcript.length > 0) {
    const { profile } = await scoreTranscriptEnsemble({ role: domain || 'the role', messages: transcript, nRaters: 2, evasions })
    if (profile) report.eie = profile
  }

  try {
    const { rows } = await query(
      `INSERT INTO expert_assessments
         (candidate_user_id, domain, transcript, report, expertise_score, expertise_level)
       VALUES ($1, $2, $3::jsonb, $4::jsonb, $5, $6)
       RETURNING id, created_at`,
      [
        user.id,
        domain || null,
        JSON.stringify(Array.isArray(transcript) ? transcript : []),
        JSON.stringify(report),
        Number.isFinite(report.expertise_score) ? report.expertise_score : null,
        report.expertise_level || null,
      ]
    )
    return NextResponse.json({ id: rows[0].id, created_at: rows[0].created_at })
  } catch (e) {
    console.error('save-expert-report error:', e)
    return NextResponse.json({ error: e.message || 'Save failed' }, { status: 500 })
  }
}
