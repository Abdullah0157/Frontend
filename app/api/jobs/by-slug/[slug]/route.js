import { NextResponse } from 'next/server'
import { query } from '@/lib/db'

export const runtime = 'nodejs'

export async function GET(_req, { params }) {
  try {
    const { slug } = params
    const { rows } = await query(
      `SELECT id, slug, title, role, description, company,
              required_assessments, requires_ai_interview
       FROM interview_jobs WHERE slug = $1`,
      [slug]
    )
    if (rows.length === 0) return NextResponse.json({ error: 'Job not found' }, { status: 404 })
    return NextResponse.json({ job: rows[0] })
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
