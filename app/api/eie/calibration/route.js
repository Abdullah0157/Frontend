import { NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { validitySummary, recalibrateBar, recalibrateWeights } from '@/lib/calibration'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// POST /api/eie/calibration
//   { pairs: [{p, outcome}] }  → compute validity directly (no DB; for testing)
//   { minN? }                  → read stored eie_outcomes and compute everything
// Returns predictive validity + recalibrated bar & weights, or insufficient_data.
export async function POST(req) {
  const body = await req.json().catch(() => ({}))
  const minN = body.minN ?? 50

  // Direct mode (pure compute, no DB) — used by tests & ad-hoc analysis.
  if (Array.isArray(body.pairs)) {
    return NextResponse.json({ validity: validitySummary(body.pairs, { minN }) })
  }

  // Stored mode — read outcomes accumulated via /api/eie/outcome.
  try {
    const { rows } = await query(
      `SELECT predicted_p, composite_theta, competency_thetas, success FROM eie_outcomes`
    ).catch(() => ({ rows: [] }))

    const pairs = rows.filter((r) => r.predicted_p != null).map((r) => ({ p: Number(r.predicted_p), outcome: r.success ? 1 : 0 }))
    const barRows = rows.filter((r) => r.composite_theta != null).map((r) => ({ theta: Number(r.composite_theta), outcome: r.success ? 1 : 0 }))
    const weightRows = rows.filter((r) => r.competency_thetas).map((r) => ({ thetas: r.competency_thetas, outcome: r.success ? 1 : 0 }))
    const compIds = [...new Set(weightRows.flatMap((r) => Object.keys(r.thetas || {})))]

    return NextResponse.json({
      n: rows.length,
      validity: validitySummary(pairs, { minN }),
      recalibrated_bar: recalibrateBar(barRows),
      recalibrated_weights: recalibrateWeights(weightRows, compIds),
    })
  } catch (e) {
    return NextResponse.json({ error: e.message || 'calibration failed' }, { status: 500 })
  }
}
