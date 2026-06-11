const MODEL = process.env.NEXT_PUBLIC_GEMINI_MODEL || 'gemini-2.5-flash'

export async function callGemini(body) {
  const keys = [process.env.GEMINI_API_KEY, process.env.GEMINI_API_KEY_FALLBACK].filter(Boolean)
  if (keys.length === 0) {
    return { ok: false, status: 500, data: { error: { message: 'No GEMINI_API_KEY configured' } } }
  }
  let lastRes = null
  let lastData = null
  for (let i = 0; i < keys.length; i++) {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${keys[i]}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }
    )
    const data = await res.json().catch(() => ({}))
    if (res.ok) return { ok: true, status: 200, data, keyIndex: i }
    lastRes = res
    lastData = data
    const retriable = res.status === 401 || res.status === 403 || res.status === 429 || res.status >= 500
    if (!retriable) break
    console.warn(`Gemini key #${i + 1} failed (${res.status}). Trying next…`)
  }
  return { ok: false, status: lastRes?.status || 500, data: lastData || {} }
}

// Returns a fetch Response with SSE body — caller streams text deltas from it.
export async function callGeminiStream(body) {
  const keys = [process.env.GEMINI_API_KEY, process.env.GEMINI_API_KEY_FALLBACK].filter(Boolean)
  if (keys.length === 0) throw new Error('No GEMINI_API_KEY configured')
  for (let i = 0; i < keys.length; i++) {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:streamGenerateContent?alt=sse&key=${keys[i]}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }
    )
    if (res.ok) return res
    const retriable = res.status === 401 || res.status === 403 || res.status === 429 || res.status >= 500
    if (!retriable) throw new Error(`Gemini stream error ${res.status}`)
    console.warn(`Gemini stream key #${i + 1} failed (${res.status}). Trying next…`)
  }
  throw new Error('All Gemini keys failed for streaming')
}

export function textFrom(data) {
  return data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || ''
}

export function stripJsonFences(text) {
  return text.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim()
}
