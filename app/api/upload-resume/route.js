import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const MAX_BYTES = 5 * 1024 * 1024 // 5 MB

// Uses `unpdf` — a PDF text extractor built for serverless/edge (bundles a
// worker-free, canvas-free pdfjs). The raw `pdfjs-dist` legacy build crashed at
// import time on Vercel (missing DOM/canvas globals), so resume upload never
// worked in production. unpdf just works in the Node serverless runtime.
export async function POST(req) {
  try {
    const form = await req.formData()
    const file = form.get('file')
    if (!file || typeof file === 'string') {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 })
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: 'File too large (max 5 MB)' }, { status: 413 })
    }
    if (file.type && !/pdf/i.test(file.type)) {
      return NextResponse.json({ error: 'Only PDF files are supported' }, { status: 415 })
    }

    const uint8 = new Uint8Array(await file.arrayBuffer())

    const { extractText, getDocumentProxy } = await import('unpdf')
    const pdf = await getDocumentProxy(uint8)
    const { totalPages, text: pages } = await extractText(pdf, { mergePages: true })

    const text = (typeof pages === 'string' ? pages : (Array.isArray(pages) ? pages.join('\n') : '')).trim()
    // The interview flow (page gate + detect-domain) requires >= 50 chars of
    // resume text. Enforce the SAME minimum here so a "successful" upload always
    // means the interview can actually start — otherwise a mostly-image PDF that
    // extracts a sliver of text uploads fine, then silently blocks the interview
    // with a confusing "upload your resume first". Keep thresholds in lockstep.
    const MIN_RESUME_CHARS = 50
    if (text.length < MIN_RESUME_CHARS) {
      return NextResponse.json(
        {
          error: text.length === 0
            ? 'Could not read any text from this PDF — it looks scanned or image-only. Please upload a text-based PDF (exported from Word/Google Docs), not a scan.'
            : 'We could only read a few characters from this PDF, not enough to build your interview. It may be scanned or image-based. Please upload a text-based PDF exported from Word or Google Docs.',
        },
        { status: 422 }
      )
    }
    const capped = text.length > 12000 ? text.slice(0, 12000) + '\n[...truncated]' : text

    return NextResponse.json({ text: capped, pages: totalPages || 1, chars: capped.length })
  } catch (e) {
    console.error('upload-resume error:', e)
    return NextResponse.json({ error: 'Could not process the PDF. Please try a different file.' }, { status: 500 })
  }
}
