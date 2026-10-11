import { NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { apiUser, ROLES } from '@/lib/roles'

export const dynamic = 'force-dynamic'

// Company "Contact us" messages, for the admin.
export async function GET() {
  const { response } = await apiUser(ROLES.SUPER_ADMIN)
  if (response) return response
  const { rows } = await query(
    `SELECT id, name, company, email, phone, message, status, created_at
     FROM company_enquiries ORDER BY created_at DESC LIMIT 200`
  ).catch(() => ({ rows: [] }))
  return NextResponse.json({ enquiries: rows })
}

// Body: { id, status: 'new' | 'contacted' | 'closed' }
export async function PATCH(req) {
  const { response } = await apiUser(ROLES.SUPER_ADMIN)
  if (response) return response
  const { id, status } = await req.json().catch(() => ({}))
  if (!['new', 'contacted', 'closed'].includes(status) || !Number.isInteger(Number(id))) {
    return NextResponse.json({ error: 'id and status (new, contacted, closed) required' }, { status: 400 })
  }
  const { rowCount } = await query(`UPDATE company_enquiries SET status = $1 WHERE id = $2`, [status, Number(id)])
  return rowCount ? NextResponse.json({ ok: true }) : NextResponse.json({ error: 'Not found' }, { status: 404 })
}
