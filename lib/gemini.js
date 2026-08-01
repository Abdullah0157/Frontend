const MODEL = process.env.NEXT_PUBLIC_GEMINI_MODEL || 'gemini-2.5-flash'

// Groq rate limits (esp. the daily token cap, TPD) are PER MODEL. When the best
// model is exhausted for the day, its budget is gone but other models still have
// their own separate budgets. So we fall down this chain on 429 — quality first,
// then progressively larger-budget models — instead of failing the whole request.
// llama-3.1-8b-instant has ~5x the daily token budget of the 70b model, so it's a
// reliable last resort that keeps interviews running.
const GROQ_MODELS = (process.env.GROQ_MODELS
  ? process.env.GROQ_MODELS.split(',').map((s) => s.trim()).filter(Boolean)
  : ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant'])

// Convert Gemini-format body → OpenAI-compatible body (for Groq)
function toOpenAIBody(geminiBody, model, stream = false) {
  const { contents = [], generationConfig = {}, systemInstruction } = geminiBody
  const messages = []

  // Move systemInstruction into a proper system message for Groq/OpenAI
  if (systemInstruction) {
    const sysText = systemInstruction.parts?.map((p) => p.text || '').join('') || ''
    if (sysText) messages.push({ role: 'system', content: sysText })
  }

  messages.push(...contents.map((c) => ({
    role: c.role === 'model' ? 'assistant' : 'user',
    content: c.parts?.map((p) => p.text || '').join('') || '',
  })))

  return {
    model,
    messages,
    temperature: generationConfig.temperature ?? 0.7,
    max_tokens: generationConfig.maxOutputTokens ?? 1000,
    stream,
  }
}

async function callGroq(geminiBody) {
  const keys = [process.env.GROQ_API_KEY, process.env.GROQ_API_KEY_FALLBACK].filter(Boolean)
  if (keys.length === 0) return { ok: false, status: 500, data: { error: { message: 'No GROQ_API_KEY configured' } } }

  let lastErr = { status: 500, data: { error: { message: 'Groq unavailable' } } }
  // Try each (key × model) combination; drop to the next on a rate-limit / server
  // error. A different model — or a second key — has an independent daily budget.
  for (const key of keys) {
    for (const model of GROQ_MODELS) {
      try {
        const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
          body: JSON.stringify(toOpenAIBody(geminiBody, model, false)),
        })
        const data = await res.json().catch(() => ({}))
        if (res.ok) {
          const text = data.choices?.[0]?.message?.content?.trim() || ''
          // Wrap in Gemini-compatible shape so textFrom() and callers work unchanged
          return { ok: true, status: 200, data: { candidates: [{ content: { parts: [{ text }] } }] } }
        }
        console.error(`Groq error (model ${model}):`, data?.error?.message || res.status)
        lastErr = { status: res.status, data }
        // Only worth trying another model/key on capacity/server errors.
        if (res.status !== 429 && res.status < 500) return { ok: false, status: res.status, data }
      } catch (e) {
        lastErr = { status: 500, data: { error: { message: e.message } } }
      }
    }
  }
  return { ok: false, ...lastErr }
}

export async function callGemini(body) {
  const keys = [process.env.GEMINI_API_KEY, process.env.GEMINI_API_KEY_FALLBACK].filter(Boolean)

  if (keys.length > 0) {
    let allRateLimitedOrNetworkFail = true
    let lastRes = null
    let lastData = null

    for (let i = 0; i < keys.length; i++) {
      let res, data
      try {
        res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${keys[i]}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          }
        )
        data = await res.json().catch(() => ({}))
      } catch (netErr) {
        // Network / DNS / timeout — treat as retriable, keep the "fall through to Groq" invariant.
        console.warn(`Gemini key #${i + 1} network error: ${netErr.message}. Trying next…`)
        continue
      }
      if (res.ok) return { ok: true, status: 200, data, keyIndex: i }
      lastRes = res
      lastData = data
      if (res.status !== 429) allRateLimitedOrNetworkFail = false
      const retriable = res.status === 401 || res.status === 403 || res.status === 429 || res.status >= 500
      if (!retriable) break
      console.warn(`Gemini key #${i + 1} failed (${res.status}). Trying next…`)
    }

    // All Gemini keys either rate-limited or network-failed → fall through to Groq.
    // If we have a non-429 API error (auth, bad request, etc.), surface it instead.
    if (!allRateLimitedOrNetworkFail && lastRes) {
      return { ok: false, status: lastRes.status, data: lastData || {} }
    }
    console.warn('Gemini unavailable (rate-limited or network) — falling back to Groq')
  }

  return callGroq(body)
}

// Returns a fetch Response with SSE body for streaming questions.
// If all Gemini keys fail (429), throws so route.js catches it and
// falls back to callGemini() → which then hits Groq.
export async function callGeminiStream(body) {
  const keys = [process.env.GEMINI_API_KEY, process.env.GEMINI_API_KEY_FALLBACK].filter(Boolean)
  if (keys.length === 0) throw new Error('No GEMINI_API_KEY configured')
  for (let i = 0; i < keys.length; i++) {
    let res
    try {
      res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:streamGenerateContent?alt=sse&key=${keys[i]}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        }
      )
    } catch (netErr) {
      console.warn(`Gemini stream key #${i + 1} network error: ${netErr.message}. Trying next…`)
      continue
    }
    if (res.ok) return res
    const retriable = res.status === 401 || res.status === 403 || res.status === 429 || res.status >= 500
    if (!retriable) throw new Error(`Gemini stream error ${res.status}`)
    console.warn(`Gemini stream key #${i + 1} failed (${res.status}). Trying next…`)
  }
  // All Gemini keys unavailable (rate-limited or network) — throw so route.js
  // falls back to callGemini → which then hits Groq.
  throw new Error('Gemini unavailable (all keys) — falling back to Groq')
}

export function textFrom(data) {
  return data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || ''
}

export function stripJsonFences(text) {
  return text.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim()
}
