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

export async function query(text, params) {
  const res = await getPool().query(text, params)
  return res
}
