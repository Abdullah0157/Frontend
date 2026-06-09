import { NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { makeSlug } from '@/lib/slug'

export const dynamic = 'force-dynamic'

// Convert HTML description to plain-ish text for prompting.
function stripHtml(s) {
  if (!s) return ''
  return String(s)
    .replace(/<\s*br\s*\/?>/gi, '\n')
    .replace(/<\s*\/p\s*>/gi, '\n\n')
    .replace(/<\s*\/li\s*>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

// Accepts the aggregated job blob and returns (or creates) a matching interview_jobs row.
export async function POST(req) {
  try {
    const { externalId, title, company, role, description } = await req.json()
    if (!externalId || !title || !description) {
      return NextResponse.json({ error: 'externalId, title, description required' }, { status: 400 })
    }

    const existing = await query(
      `SELECT id, slug, title, role, description, company FROM interview_jobs WHERE external_job_id = $1`,
      [String(externalId)]
    )
    if (existing.rowCount > 0) {
      return NextResponse.json({ job: existing.rows[0], created: false })
    }

    const slug = makeSlug()
    const cleanedDesc = stripHtml(description)
    const finalRole = (role || title || 'the role').toString().slice(0, 120)

    const { rows } = await query(
      `INSERT INTO interview_jobs (slug, title, role, description, external_job_id, company)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, slug, title, role, description, company`,
      [slug, title, finalRole, cleanedDesc, String(externalId), company || null]
    )
    return NextResponse.json({ job: rows[0], created: true }, { status: 201 })
  } catch (e) {
    console.error('from-external error:', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
