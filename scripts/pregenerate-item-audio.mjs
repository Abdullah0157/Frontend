// Generates and caches the audio for every live English item (listening clips
// and spoken prompts), so no candidate waits on the voice service mid-test.
//   node scripts/pregenerate-item-audio.mjs
import { readFileSync } from 'node:fs'
for (const line of readFileSync(new URL('../.env.local', import.meta.url), 'utf8').split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.+?)\s*$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2]
}
const { query } = await import('../lib/db.js')
const { promptAudio, audioHash } = await import('../lib/speech.js')
const { rows } = await query(`SELECT bank_key, scoring_rubric FROM items WHERE status = 'live' AND type IN ('listening','speaking')`)
let made = 0, cached = 0, failed = 0
for (const r of rows) {
  const lines = r.scoring_rubric?.audio?.lines
  if (!lines?.length) continue
  const { rows: have } = await query(`SELECT 1 FROM item_audio_cache WHERE content_hash = $1`, [audioHash(lines)])
  if (have.length) { cached++; continue }
  try { await promptAudio(lines); made++ } catch (e) { failed++; console.log(`FAILED ${r.bank_key}: ${e.message}`) }
  await new Promise((res) => setTimeout(res, 1000)) // the voice service throttles bursts
}
console.log(`Audio ready: ${made} generated, ${cached} already cached, ${failed} failed (of ${rows.length} English items).`)
await globalThis._pgPool?.end?.()
process.exit(failed ? 1 : 0)
