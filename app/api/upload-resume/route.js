import { NextResponse } from 'next/server'
import { PDFParse } from 'pdf-parse'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const MAX_BYTES = 5 * 1024 * 1024 // 5 MB

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
    const parser = new PDFParse({ data: buf })
    const parsed = await parser.getText()
    const text = (parsed.text || '').trim()

    if (!text) {
      return NextResponse.json({ error: 'Could not extract text from PDF' }, { status: 422 })
    }
    const capped = text.length > 12000 ? text.slice(0, 12000) + '\n[...truncated]' : text

    return NextResponse.json({
      text: capped,
      pages: parsed.total,
      chars: capped.length,
    })
  } catch (e) {
    console.error('upload-resume error:', e)
    return NextResponse.json({ error: e.message || 'Failed to parse PDF' }, { status: 500 })
  }
}
