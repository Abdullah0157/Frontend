// Reads the text of an uploaded PDF resume. Shared by resume upload and resume
// matching.
//
// Uses `unpdf`, a PDF text extractor built for serverless (it bundles a
// worker-free, canvas-free pdfjs). The raw `pdfjs-dist` legacy build crashed at
// import time on Vercel (missing DOM/canvas globals), so resume upload never
// worked in production; unpdf works in the Node runtime.

export const MAX_RESUME_BYTES = 5 * 1024 * 1024 // 5 MB

// The interview flow (page gate + detect-domain) requires >= 50 characters of
// resume text. The same minimum applies here so a "successful" upload always
// means the interview can start, instead of a mostly-image PDF uploading fine
// and then blocking the interview with "upload your resume first".
export const MIN_RESUME_CHARS = 50

export class ResumeError extends Error {
  constructor(message, status) {
    super(message)
    this.status = status
  }
}

// Returns { text, pages } or throws a ResumeError with a message for the user.
export async function readResumePdf(file) {
  if (!file || typeof file === 'string') throw new ResumeError('No file uploaded', 400)
  if (file.size > MAX_RESUME_BYTES) throw new ResumeError('File too large (max 5 MB)', 413)
  if (file.type && !/pdf/i.test(file.type)) throw new ResumeError('Only PDF files are supported', 415)

  const { extractText, getDocumentProxy } = await import('unpdf')
  const pdf = await getDocumentProxy(new Uint8Array(await file.arrayBuffer()))
  const { totalPages, text: pages } = await extractText(pdf, { mergePages: true })
  const text = (typeof pages === 'string' ? pages : (Array.isArray(pages) ? pages.join('\n') : '')).trim()
  if (text.length < MIN_RESUME_CHARS) {
    throw new ResumeError(text.length === 0
      ? 'Could not read any text from this PDF — it looks scanned or image-only. Please upload a text-based PDF (exported from Word/Google Docs), not a scan.'
      : 'We could only read a few characters from this PDF, not enough to build your interview. It may be scanned or image-based. Please upload a text-based PDF exported from Word or Google Docs.', 422)
  }
  return { text: text.length > 12000 ? text.slice(0, 12000) + '\n[...truncated]' : text, pages: totalPages || 1 }
}
