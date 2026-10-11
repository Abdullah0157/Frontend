import { NextResponse } from 'next/server'
import { query } from '@/lib/db'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET /api/cron/purge: run once a day by Vercel Cron (vercel.json). Deletes
// voice recordings and camera photos older than 90 days, as the privacy page
// promises. Vercel sends "Authorization: Bearer <CRON_SECRET>"; anything else
// is refused.
export async function GET(req) {
  const secret = process.env.CRON_SECRET
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Not allowed' }, { status: 401 })
  }
  const audio = await query(`DELETE FROM assessment_audio WHERE created_at < now() - interval '90 days'`).catch((e) => ({ error: e.message }))
  const photos = await query(`DELETE FROM assessment_snapshots WHERE created_at < now() - interval '90 days'`).catch((e) => ({ error: e.message }))
  const result = { recordingsDeleted: audio.rowCount ?? null, photosDeleted: photos.rowCount ?? null, errors: [audio.error, photos.error].filter(Boolean) }
  console.log('purge:', JSON.stringify(result))
  return NextResponse.json(result, { status: result.errors.length ? 500 : 200 })
}
