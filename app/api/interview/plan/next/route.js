import { NextResponse } from 'next/server'
import { scoreTranscript } from '@/lib/eie-rate'
import { buildStrategy, planFromProfile, extractResumeHooks } from '@/lib/interview-planner'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// POST /api/interview/plan/next
// Body: { role, seniority?, messages, resumeText?, prev?, turnsSpent? }
//   prev = { belief, target_id } from the previous plan (drives the Critic)
// The belief loop: score the transcript-so-far → belief + critic verdict + next
// target + decision + ready-to-conclude. See INTERVIEWER_ENGINE.md §10.
export async function POST(req) {
  const { role = 'the role', seniority = '', messages = [], resumeText = '', prev = null, turnsSpent = {} } =
    await req.json().catch(() => ({}))

  const baseStrategy = buildStrategy(role, seniority || role)
  const hooks = extractResumeHooks(resumeText, baseStrategy.model)
  const strategy = buildStrategy(role, seniority || role, hooks)

  const hasAnswers = Array.isArray(messages) && messages.some((m) => m.role === 'user')
  if (!hasAnswers) {
    return NextResponse.json({
      phase: 'opening',
      belief: strategy.objectives.map((o) => ({ competency_id: o.competency_id, name: o.name, status: 'unknown', importance: o.importance })),
      coverage: 0, next_target: null, ready_to_conclude: false, critique: null,
    })
  }

  const { profile, error } = await scoreTranscript({ role, seniority, messages })
  if (!profile) return NextResponse.json({ error: error || 'scoring failed' }, { status: 502 })

  const answered = messages.filter((m) => m.role === 'user').length
  const plan = planFromProfile(strategy, profile, {
    answered, turnsSpent,
    prevBelief: prev?.belief || null,
    lastTarget: prev?.target_id || null,
  })
  return NextResponse.json(plan)
}
