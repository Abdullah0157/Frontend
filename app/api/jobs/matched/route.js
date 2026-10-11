import { NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { apiUser } from '@/lib/roles'
import { listOpenJobs, rankJobs, resumeKeywords } from '@/lib/job-match'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// GET /api/jobs/matched: open jobs ranked against the logged-in user's saved
// resume (unranked when they have none).
export async function GET() {
  try {
    const { user, response } = await apiUser()
    if (response) return response
    const { rows } = await query(`SELECT resume_text FROM user_profiles WHERE user_id = $1`, [user.id])
    const resumeText = rows[0]?.resume_text
    const jobs = await listOpenJobs()
    if (!resumeText) return NextResponse.json({ jobs, ranked: false })
    return NextResponse.json({ jobs: rankJobs(jobs, resumeText), ranked: true, keywords_used: resumeKeywords(resumeText).length })
  } catch (e) {
    console.error('matched route error:', e)
    return NextResponse.json({ error: 'Could not load matched jobs.' }, { status: 500 })
  }
}
