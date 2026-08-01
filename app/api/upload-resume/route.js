import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const MAX_BYTES = 5 * 1024 * 1024 // 5 MB

// pdfjs is loaded LAZILY inside the handler (not at module top level). A
// top-level ESM import of the legacy build + a filesystem worker path
// (file://process.cwd()/node_modules/...) crashed the whole route module on
// Vercel — even a GET returned 500 — so resume upload never worked in prod.
// Loading on demand and running pdfjs in-process (no separate worker file) is
// the reliable serverless pattern.
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

    let pdfjs
    try {
      pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')
    } catch (impErr) {
      console.error('pdfjs import failed:', impErr)
      return NextResponse.json({ error: 'PDF reader unavailable — please try again.' }, { status: 500 })
    }

    // Run WITHOUT a separate worker (main-thread fake worker in Node). Do NOT set
    // GlobalWorkerOptions.workerSrc to a filesystem path — it isn't reliably
    // present in the Vercel bundle and breaks the whole route.
    const doc = await pdfjs.getDocument({
      data: uint8,
      isEvalSupported: false,
      useSystemFonts: true,
      useWorkerFetch: false,
      disableFontFace: true,
    }).promise

    let text = ''
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i)
      const content = await page.getTextContent()
      text += content.items.map((item) => item.str).join(' ') + '\n'
    }
    text = text.trim()

    if (!text) {
      return NextResponse.json(
        { error: 'Could not read text from this PDF (it may be a scanned/image-only file).' },
        { status: 422 }
      )
    }
    const capped = text.length > 12000 ? text.slice(0, 12000) + '\n[...truncated]' : text

    return NextResponse.json({ text: capped, pages: doc.numPages, chars: capped.length })
  } catch (e) {
    console.error('upload-resume error:', e)
    return NextResponse.json({ error: 'Could not process the PDF. Please try a different file.' }, { status: 500 })
  }
}
