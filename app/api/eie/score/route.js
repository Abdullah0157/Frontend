import { NextResponse } from 'next/server'
import { scoreTranscriptEnsemble } from '@/lib/eie-rate'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// POST /api/eie/score
// Body: { role, seniority?, nRaters?, messages: [{role, content}] }
// Returns the EIE competency profile + decision (ensemble + G-theory + verify).
export async function POST(req) {
  const { role = 'the role', seniority = '', messages = [], nRaters = 2 } = await req.json().catch(() => ({}))
  if (!Array.isArray(messages) || messages.length === 0) {
    return NextResponse.json({ error: 'messages required' }, { status: 400 })
  }
  const { profile, error } = await scoreTranscriptEnsemble({ role, seniority, messages, nRaters })
  if (!profile) return NextResponse.json({ error: error || 'scoring failed' }, { status: 502 })
  return NextResponse.json({ profile })
}
