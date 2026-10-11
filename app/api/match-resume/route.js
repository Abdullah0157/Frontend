import { NextResponse } from 'next/server'
import { limitOrNull } from '@/lib/rate-limit'
import { readResumePdf, ResumeError } from '@/lib/resume-pdf'
import { listOpenJobs, rankJobs } from '@/lib/job-match'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// POST /api/match-resume (multipart "file"): open jobs ranked against an
// uploaded PDF resume, best first. Replaces the old hosted backend's
// /api/match-resume. Nothing is stored. Open to visitors, limited per address.
export async function POST(req) {
  const limited = await limitOrNull(req, [
    { bucket: 'match-resume', limit: 20, windowSec: 3600, message: 'Too many resume uploads. Please try again a little later.' },
  ])
  if (limited) return limited
  try {
    const form = await req.formData()
    const { text } = await readResumePdf(form.get('file'))
    const jobs = rankJobs(await listOpenJobs(), text).filter((j) => j.match_score > 0).slice(0, 20)
    return NextResponse.json(jobs)
  } catch (e) {
    if (e instanceof ResumeError) return NextResponse.json({ error: e.message }, { status: e.status })
    console.error('match-resume error:', e)
    return NextResponse.json({ error: 'Could not match this resume. Please try a different file.' }, { status: 500 })
  }
}
