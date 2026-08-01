// End-to-end integration test for the assessment flow over real HTTP.
// start → respond loop (answering each item type) → completion → GET report.

const BASE = 'http://localhost:3002/api/assessment'

// Realistic answers per item type so AI scoring has something to grade.
function answerFor(item) {
  if (item.type === 'mcq') return { choice_index: 2 }
  if (item.type === 'coding') {
    return { code: `def solution(n):\n    # amortized O(1) token bucket\n    import time\n    self_tokens = {}\n    return True` }
  }
  // scenario_response
  return { text: 'At Stripe I owned the settlement pipeline handling ~40M transactions/day. I chose eventual consistency with a 15-minute reconciliation SLA because synchronous cross-region replication would add unacceptable write latency. The accepted failure mode is a brief window where regions disagree, mitigated by an idempotent reconciliation job. During a currency flash crash we reconciled ~8M in adjustments this way, and afterward I added volatility-aware cache invalidation so stale rates could not persist.' }
}

async function main() {
  // 1. Start
  const startRes = await fetch(`${BASE}/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ roleFamily: 'swe-backend', seniorityBand: 'L4' }),
  })
  const start = await startRes.json()
  console.log(`START → session ${start.sessionId?.slice(0, 8)} · first item: ${start.item?.type}`)
  let item = start.item
  const sessionId = start.sessionId
  let guard = 0

  // 2. Respond loop
  while (item && guard++ < 12) {
    const res = await fetch(`${BASE}/respond`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId, itemId: item.id, response: answerFor(item), timeSpentMs: 120000,
      }),
    })
    const data = await res.json()
    if (data.status === 'completed') {
      console.log(`RESPOND → completed (reason: ${data.reason}) · overallScore=${data.overallScore} · rec=${data.recommendation}`)
      break
    }
    console.log(`RESPOND → scored ${item.type}: ${data.lastScore == null ? 'pending' : data.lastScore.toFixed(3)} · next: ${data.item?.type}`)
    item = data.item
  }

  // 3. GET final report
  const getRes = await fetch(`${BASE}/${sessionId}`)
  const full = await getRes.json()
  const r = full.report
  console.log('\n=== FINAL REPORT ===')
  if (!r) {
    console.log('❌ No report generated')
  } else {
    console.log(`overall_score : ${r.overall_score}/10`)
    console.log(`recommendation: ${r.recommendation}`)
    console.log(`summary       : ${r.summary?.slice(0, 160)}`)
    console.log(`strengths     : ${(r.strengths || []).length}`)
    console.log(`concerns      : ${(r.concerns || []).length}`)
  }
  console.log(`\nresponses     : ${full.responses?.length} (scored: ${full.responses?.filter(x => x.score != null).length})`)
  const scores = (full.responses || []).map(x => x.score).filter(x => x != null)
  console.log(`response scores: ${scores.map(s => s.toFixed(2)).join(', ') || '(none scored)'}`)
  console.log(`skillDeltas   : ${full.skillDeltas?.length} (empty expected for anonymous session)`)
}

main().catch(e => { console.error('FATAL:', e.message); process.exit(1) })
