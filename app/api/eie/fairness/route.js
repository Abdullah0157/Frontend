import { NextResponse } from 'next/server'
import { biasAuditSummary, adverseImpact, differentialItemFunctioning } from '@/lib/fairness'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// POST /api/eie/fairness
// Runs the fairness computations over a supplied cohort. Demographic labels come
// from the caller (HRIS-sourced) — never elicited in the interview. Body:
//   { decisions: [{ band, group }], selectionRows?: [{group, selected}],
//     difRows?: [{group, ability_band, score}], focal?, reference? }
export async function POST(req) {
  const body = await req.json().catch(() => ({}))
  const out = {}
  if (Array.isArray(body.decisions)) out.audit = biasAuditSummary({ decisions: body.decisions })
  if (Array.isArray(body.selectionRows)) out.adverse_impact = adverseImpact(body.selectionRows)
  if (Array.isArray(body.difRows) && body.focal && body.reference) {
    out.dif = differentialItemFunctioning(body.difRows, { focal: body.focal, reference: body.reference })
  }
  if (Object.keys(out).length === 0) {
    return NextResponse.json({ error: 'provide decisions, selectionRows, or difRows' }, { status: 400 })
  }
  return NextResponse.json(out)
}
