import { query } from '@/lib/db'
import { percentileRank, topLabel } from '@/lib/expert-rubric'
import ExpertAssessmentList from './ExpertAssessmentList'

export const dynamic = 'force-dynamic'

async function fetchAssessments() {
  const res = await query(
    `SELECT ea.id, ea.domain, ea.expertise_score, ea.expertise_level,
            ea.transcript, ea.report, ea.created_at,
            up.full_name AS candidate_name
     FROM expert_assessments ea
     LEFT JOIN user_profiles up ON up.user_id = ea.candidate_user_id
     ORDER BY ea.created_at DESC
     LIMIT 100`
  ).catch(() => ({ rows: [] }))
  return res.rows || []
}

// Base domain = everything before the " · " test-label suffix, so ranking
// groups real peers ("Backend Engineering") regardless of test tags.
function baseDomain(d) {
  return String(d || 'General').split(' · ')[0].trim()
}

// Attach a percentile rank + "Top X%" label to each assessment, computed
// against peers who share the same base domain.
function withRanking(rows) {
  const byDomain = {}
  for (const r of rows) {
    const k = baseDomain(r.domain)
    ;(byDomain[k] ||= []).push(Number(r.expertise_score))
  }
  return rows.map((r) => {
    const peers = byDomain[baseDomain(r.domain)] || []
    const pct = percentileRank(Number(r.expertise_score), peers)
    return {
      ...r,
      base_domain: baseDomain(r.domain),
      percentile: pct,
      top_label: topLabel(pct),
      peer_count: peers.filter((n) => Number.isFinite(n)).length,
    }
  })
}

export default async function AdminExpertAssessmentsPage() {
  const assessments = withRanking(await fetchAssessments())
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[28px] font-semibold text-slate-900 tracking-tight">Expert Interviews</h1>
        <p className="text-slate-500 mt-1.5">
          Every Domain Expert (Maya) interview with its full transcript and AI rubric. {assessments.length} total.
        </p>
      </div>
      <ExpertAssessmentList assessments={assessments} />
    </div>
  )
}
