// Typing test measurement (customer service). Pure, so it is unit-tested.
//
// The candidate types a given passage for a fixed time. We align what they
// typed with the start of the passage word by word (edit distance), so a
// skipped or extra word costs one error instead of shifting every word after
// it. Then:
//   gross speed = typed characters / 5 per minute (the standard "word")
//   net speed   = gross speed minus uncorrected word errors per minute
//   accuracy    = correctly typed words / words typed
// Scoring has a gentle slope below the pass mark, so one slow minute does not
// wipe a candidate out.

export function wordEditDistance(a, b) {
  const prev = new Array(b.length + 1)
  const cur = new Array(b.length + 1)
  for (let j = 0; j <= b.length; j++) prev[j] = j
  for (let i = 1; i <= a.length; i++) {
    cur[0] = i
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
    }
    for (let j = 0; j <= b.length; j++) prev[j] = cur[j]
  }
  return prev[b.length]
}

const words = (s) => String(s || '').trim().split(/\s+/).filter(Boolean)

export function typingMetrics(passage, typed, elapsedMs) {
  const P = words(passage)
  const T = words(typed)
  const minutes = Math.max(1000, elapsedMs) / 60000
  if (T.length === 0) return { words: 0, errors: 0, grossWpm: 0, netWpm: 0, accuracy: 0, minutes }
  // Compare with the passage prefix that fits best (the candidate may have
  // skipped or added a few words near the end).
  let errors = Infinity
  for (let m = Math.max(0, T.length - 5); m <= Math.min(P.length, T.length + 5); m++) {
    errors = Math.min(errors, wordEditDistance(T, P.slice(0, m)))
  }
  const chars = String(typed).trim().length
  const grossWpm = chars / 5 / minutes
  const netWpm = Math.max(0, grossWpm - errors / minutes)
  const accuracy = Math.max(0, (T.length - errors) / T.length) * 100
  return {
    words: T.length,
    errors,
    grossWpm: Number(grossWpm.toFixed(1)),
    netWpm: Number(netWpm.toFixed(1)),
    accuracy: Number(accuracy.toFixed(1)),
    minutes: Number(minutes.toFixed(2)),
  }
}

// 0..1. Full marks at or above both pass marks. Below the speed mark the
// score falls in a straight line; accuracy loses everything 15 points below
// its mark.
export function typingScore(metrics, { netWpm: passWpm, accuracy: passAcc }) {
  const speed = Math.min(1, metrics.netWpm / passWpm)
  const acc = metrics.accuracy >= passAcc ? 1 : Math.max(0, 1 - (passAcc - metrics.accuracy) / 15)
  return Number((0.6 * speed + 0.4 * acc).toFixed(3))
}

// Time used for the speed calculation. The browser reports how long the
// candidate typed for; the server knows when the section started. A browser
// claiming a much shorter time than the server saw (allowing 90 seconds to read
// the passage first) is not believed, so speed cannot be faked upward.
export function trustedElapsedMs(clientMs, serverMs, limitMs) {
  const client = Number.isFinite(clientMs) && clientMs > 0 ? clientMs : limitMs
  const floor = Math.max(5000, (Number.isFinite(serverMs) ? serverMs : 0) - 90000)
  return Math.min(Math.max(client, floor), limitMs + 5000)
}
