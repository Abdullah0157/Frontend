// Shared helpers for the browser checks in scripts/qa. They run against the
// LOCAL test stack only (supabase/config.toml: API 56421, DB 56422) and the
// app built with that stack, on BASE (default http://localhost:3070).
//
//   PLAYWRIGHT=/path/to/playwright/index.mjs CHROMIUM=/path/to/chrome node scripts/qa/<check>.mjs
import { existsSync } from 'node:fs'
import pg from 'pg'

export const BASE = process.env.BASE || 'http://localhost:3070'
const LOCAL_DB = 'postgresql://postgres:postgres@127.0.0.1:56422/postgres'
if (!/localhost|127\.0\.0\.1/.test(BASE)) throw new Error('scripts/qa runs against the local test stack only')

const PW = process.env.PLAYWRIGHT || '/Users/ahmadabdullah/attendance-portal/node_modules/playwright/index.mjs'
// Playwright's own headless shell if installed, else the installed Google Chrome.
const CHROMIUM = process.env.CHROMIUM || [
  '/Users/ahmadabdullah/Library/Caches/ms-playwright/chromium_headless_shell-1248/chrome-headless-shell-mac-arm64/chrome-headless-shell',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
].find((p) => existsSync(p))
const { chromium } = await import(PW)
const { TEST_USERS } = await import('../local-test-users.mjs')

export const db = new pg.Pool({ connectionString: LOCAL_DB, ssl: false })
export const one = async (sql, args) => (await db.query(sql, args)).rows[0]
export const stamp = Date.now() % 1000000
export const user = (type) => TEST_USERS.find((u) => u.type === type)

let failed = 0
export function check(name, ok, detail = '') {
  if (!ok) failed++
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? `  (${detail})` : ''}`)
}

export async function launch(args = []) {
  return chromium.launch({ executablePath: CHROMIUM, headless: true, args })
}

export async function loginAs(browser, type, { viewport = { width: 1440, height: 900 }, permissions = [] } = {}) {
  const u = user(type)
  const ctx = await browser.newContext({ viewport, permissions })
  const page = await ctx.newPage()
  page.on('pageerror', (e) => console.log('   page error:', e.message))
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' })
  await page.fill('#email', u.email)
  await page.fill('#password', u.password)
  await Promise.all([page.waitForURL((x) => !x.pathname.startsWith('/login'), { timeout: 30000 }), page.getByRole('button', { name: /^sign in$/i }).click()])
  return { ctx, page }
}

// POST /api/interview from inside a logged-in page. A question streams as text.
export const interviewCall = (page, body) => page.evaluate(async (b) => {
  const r = await fetch('/api/interview', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(b) })
  const text = await r.text()
  let json = null
  try { json = JSON.parse(text) } catch {}
  return { status: r.status, text, json }
}, body)

export const newId = (page) => page.evaluate(() => crypto.randomUUID())

export async function finish() {
  await db.end()
  console.log(failed ? `${failed} FAILED` : 'ALL PASSED')
  process.exit(failed ? 1 : 0)
}
