import { NextResponse } from 'next/server'
import { query } from '@/lib/db'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const DDL = `CREATE TABLE IF NOT EXISTS eie_outcomes (
  id bigserial PRIMARY KEY,
  assessment_id bigint,
  predicted_p numeric,
  composite_theta numeric,
  competency_thetas jsonb,
  success boolean,
  outcome_type text,
  outcome_value numeric,
  created_at timestamptz DEFAULT now()
)`

// POST /api/eie/outcome
// Ingest a real hire outcome and snapshot the prediction it's evaluating.
// Body: { assessmentId, success: bool, outcome_type?, outcome_value? }
// This is the flywheel: outcomes flow back → Phase 6 calibration uses them.
export async function POST(req) {
  const { assessmentId, success, outcome_type = 'hire_success', outcome_value = null } = await req.json().catch(() => ({}))
  if (assessmentId == null || typeof success !== 'boolean') {
    return NextResponse.json({ error: 'assessmentId and boolean success required' }, { status: 400 })
  }
  try {
    await query(DDL)
    const { rows } = await query(`SELECT report FROM expert_assessments WHERE id = $1`, [assessmentId])
    if (!rows.length) return NextResponse.json({ error: 'assessment not found' }, { status: 404 })
    const eie = rows[0].report?.eie
    if (!eie) return NextResponse.json({ error: 'assessment has no EIE profile' }, { status: 409 })

    const thetas = {}
    for (const c of eie.competencies || []) if (c.state === 'measured') thetas[c.id] = c.theta

    const ins = await query(
      `INSERT INTO eie_outcomes (assessment_id, predicted_p, composite_theta, competency_thetas, success, outcome_type, outcome_value)
       VALUES ($1,$2,$3,$4::jsonb,$5,$6,$7) RETURNING id`,
      [assessmentId, eie.decision?.p_success ?? null, eie.composite_theta ?? null, JSON.stringify(thetas), success, outcome_type, outcome_value]
    )
    return NextResponse.json({ id: ins.rows[0].id, snapshot: { predicted_p: eie.decision?.p_success, composite_theta: eie.composite_theta } })
  } catch (e) {
    return NextResponse.json({ error: e.message || 'ingest failed' }, { status: 500 })
  }
}
