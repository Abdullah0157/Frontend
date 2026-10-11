// Request limits for routes that cost money or free quota (AI, voice, speech
// to text, PDF parsing). Fixed windows counted in Postgres, so the limit holds
// across server instances and restarts. If the table is missing (database not
// migrated yet) or the database errors, it falls back to a per-process count:
// weaker, but it never blocks real users because of an infrastructure problem.

import { query } from './db.js'

const memory = new Map()

function memoryCount(key, windowStart) {
  const k = `${key}@${windowStart}`
  const n = (memory.get(k) || 0) + 1
  memory.set(k, n)
  if (memory.size > 5000) {
    for (const old of memory.keys()) {
      if (Number(old.split('@').pop()) < windowStart) memory.delete(old)
    }
  }
  return n
}

// The caller's address. Behind a proxy the first x-forwarded-for entry is the
// visitor. Vercel sets this header itself; on our own server nginx must
// REPLACE it (proxy_set_header X-Forwarded-For $remote_addr), not append to
// it, or a visitor could send a fake first entry and dodge the limits.
export function clientIp(req) {
  const fwd = req.headers.get('x-forwarded-for')
  if (fwd) return fwd.split(',')[0].trim()
  return req.headers.get('x-real-ip') || 'unknown'
}

// bucket: what is limited ('interview', 'tts', ...). The caller is the user
// when logged in, otherwise their IP address; global: true counts everyone
// together (a daily ceiling that protects the free quota).
export async function rateLimit(req, bucket, { limit, windowSec, userId = null, global = false }) {
  const who = global ? 'all' : userId ? `u:${userId}` : `ip:${clientIp(req)}`
  const key = `${bucket}:${who}`
  const nowSec = Math.floor(Date.now() / 1000)
  const windowStart = Math.floor(nowSec / windowSec) * windowSec
  let count
  try {
    const { rows } = await query(
      `INSERT INTO rate_limits (key, window_start, count) VALUES ($1, to_timestamp($2), 1)
       ON CONFLICT (key, window_start) DO UPDATE SET count = rate_limits.count + 1
       RETURNING count`,
      [key, windowStart]
    )
    count = rows[0].count
    if (Math.random() < 0.01) {
      query(`DELETE FROM rate_limits WHERE window_start < now() - interval '2 days'`).catch(() => {})
    }
  } catch {
    count = memoryCount(key, windowStart)
  }
  return { ok: count <= limit, limit, remaining: Math.max(0, limit - count), retryAfter: windowStart + windowSec - nowSec }
}

// The 429 response for a request over its limit.
export function tooManyRequests(result, message = 'Too many requests. Please wait a little and try again.') {
  // A standard Response (not NextResponse) so this module also loads in
  // plain Node, for the tests.
  return Response.json(
    { error: message, retryAfterSeconds: result.retryAfter },
    { status: 429, headers: { 'Retry-After': String(result.retryAfter) } }
  )
}

// Check several limits at once (for example per user and a global daily
// ceiling); returns the 429 response for the first one exceeded, or null.
export async function limitOrNull(req, checks) {
  for (const c of checks) {
    const r = await rateLimit(req, c.bucket, c)
    if (!r.ok) return tooManyRequests(r, c.message)
  }
  return null
}
