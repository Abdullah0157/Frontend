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
    if (!text) {
      return NextResponse.json(
        { error: 'Could not read text from this PDF (it may be a scanned/image-only file).' },
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
