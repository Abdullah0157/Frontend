import { Pool } from 'pg'

let pool

export function getPool() {
  if (!pool) {
    if (!process.env.DATABASE_URL) {
      throw new Error('DATABASE_URL not set')
    }
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
      max: 1,
    })
  }
  return pool
}

export async function query(text, params) {
  const res = await getPool().query(text, params)
  return res
}
