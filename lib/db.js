import { Pool } from 'pg'

export function getPool() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL not set')
  // globalThis persists across Next.js HMR hot reloads — prevents a new Pool
  // (and new connections) being created on every file save in dev mode.
  if (!globalThis._pgPool) {
    globalThis._pgPool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
      max: 3,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    })
  }
  return globalThis._pgPool
}

// Transient network errors (DNS blips, dropped connections) are retriable —
// the DB pooler occasionally becomes briefly unreachable. Retry a few times with
// short backoff before giving up, so a momentary blip doesn't fail a request.
const TRANSIENT = new Set(['ENOTFOUND', 'ECONNRESET', 'ECONNREFUSED', 'ETIMEDOUT', 'EAI_AGAIN'])

export async function query(text, params) {
  let lastErr
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      return await getPool().query(text, params)
    } catch (e) {
      lastErr = e
      const transient = TRANSIENT.has(e.code) || /fetch failed|getaddrinfo|connection terminated/i.test(e.message || '')
      if (!transient || attempt === 3) throw e
      // If the pool got poisoned by a dead connection, drop it so we reconnect.
      try { await globalThis._pgPool?.end?.() } catch {}
      globalThis._pgPool = null
      await new Promise((r) => setTimeout(r, 800 * (attempt + 1)))
    }
  }
  throw lastErr
}
