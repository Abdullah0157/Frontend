import { NextResponse } from 'next/server'
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const MAX_BYTES = 5 * 1024 * 1024 // 5 MB

// Use process.cwd() so webpack can't statically intercept this path.
// In both local dev and Vercel, cwd is the project root where node_modules lives.
pdfjsLib.GlobalWorkerOptions.workerSrc =
  'file://' + process.cwd() + '/node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs'

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

    const buf = Buffer.from(await file.arrayBuffer())
    const uint8 = new Uint8Array(buf)

    const doc = await pdfjsLib.getDocument({
      data: uint8,
      isEvalSupported: false,
      useSystemFonts: true,
    }).promise

    let text = ''
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i)
      const content = await page.getTextContent()
      text += content.items.map((item) => item.str).join(' ') + '\n'
    }
    text = text.trim()

    if (!text) {
      return NextResponse.json({ error: 'Could not extract text from PDF' }, { status: 422 })
    }
    const capped = text.length > 12000 ? text.slice(0, 12000) + '\n[...truncated]' : text

    return NextResponse.json({
      text: capped,
      pages: doc.numPages,
      chars: capped.length,
    })
  } catch (e) {
    console.error('upload-resume error:', e)
    return NextResponse.json({ error: e.message || 'Failed to parse PDF' }, { status: 500 })
  }
}
