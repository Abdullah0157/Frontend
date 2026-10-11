import { NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { limitOrNull } from '@/lib/rate-limit'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// POST /api/contact: a company asks to use JobStream. Company accounts are
// invite-only, so this is how they reach us; messages appear in the admin
// dashboard (/admin/companies). Public, so: size limits, a hidden "website"
// field that only bots fill in, and per-address and daily limits.
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

export async function POST(req) {
  const limited = await limitOrNull(req, [
    { bucket: 'contact', limit: 5, windowSec: 3600, message: 'You have sent a few messages already. We will be in touch soon.' },
    { bucket: 'contact', limit: 300, windowSec: 86400, global: true, message: 'Please try again tomorrow, or reach us on LinkedIn.' },
  ])
  if (limited) return limited
  const body = await req.json().catch(() => ({}))
  if (body.website) return NextResponse.json({ ok: true }) // bot: pretend it worked
  const field = (k, max) => String(body[k] ?? '').trim().slice(0, max)
  const name = field('name', 120)
  const company = field('company', 160)
  const email = field('email', 200).toLowerCase()
  const phone = field('phone', 40)
  const message = field('message', 3000)
  if (!name || !company || !message) return NextResponse.json({ error: 'Please fill in your name, company and message.' }, { status: 400 })
  if (!EMAIL.test(email)) return NextResponse.json({ error: 'Please enter a valid email address.' }, { status: 400 })
  try {
    await query(
      `INSERT INTO company_enquiries (name, company, email, phone, message) VALUES ($1, $2, $3, $4, $5)`,
      [name, company, email, phone || null, message]
    )
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('contact error:', e)
    return NextResponse.json({ error: 'Could not send your message. Please try again, or reach us on LinkedIn.' }, { status: 500 })
  }
}
