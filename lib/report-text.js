// Iris reports store strengths, concerns and evidence as small records
// ({ claim, evidence: { turn, quote, quote_type } }); older reports used plain
// text. These turn either shape into text, so a page never tries to print a
// record (React cannot render one and the whole page fails).

export function claimText(item) {
  if (typeof item === 'string') return item
  return item?.claim || item?.text || ''
}

export function evidenceText(ev) {
  if (!ev) return ''
  if (typeof ev === 'string') return ev
  if (!ev.quote || ev.quote_type === 'not_assessed') return ''
  const quote = ev.quote_type === 'direct' ? `“${ev.quote}”` : ev.quote
  return ev.turn ? `${quote} (turn ${ev.turn})` : quote
}

export function highlightText(report) {
  const h = report?.highlight_moment
  if (h && typeof h === 'object') return h.quote || ''
  return report?.highlight_quote || (typeof h === 'string' ? h : '')
}
