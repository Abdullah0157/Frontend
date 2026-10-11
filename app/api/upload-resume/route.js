import { NextResponse } from 'next/server'
import { apiUser } from '@/lib/roles'
import { limitOrNull } from '@/lib/rate-limit'
import { readResumePdf, ResumeError } from '@/lib/resume-pdf'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// POST /api/upload-resume (multipart "file"): the resume's text. Logged-in
// users only, with an hourly limit (reading PDFs costs server time).
export async function POST(req) {
  const { user: caller, response: denied } = await apiUser()
  if (denied) return denied
  const limited = await limitOrNull(req, [{ bucket: 'upload-resume', limit: 30, windowSec: 3600, userId: caller.id }])
  if (limited) return limited
  try {
    const form = await req.formData()
    const { text, pages } = await readResumePdf(form.get('file'))
    return NextResponse.json({ text, pages, chars: text.length })
  } catch (e) {
    if (e instanceof ResumeError) return NextResponse.json({ error: e.message }, { status: e.status })
    console.error('upload-resume error:', e)
    return NextResponse.json({ error: 'Could not process the PDF. Please try a different file.' }, { status: 500 })
  }
}
