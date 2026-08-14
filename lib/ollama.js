// Local, zero-cost LLM path via Ollama (a free open model on the user's machine).
// Opt-in: only used when DOMAIN_EXPERT_LOCAL=1. Speaks the SAME return shape as
// lib/gemini.js callGemini() — { ok, status, data: { candidates:[{content:{parts:[{text}]}}] } }
// — so route.js's textFrom() works unchanged.
//
// Two things make a local "thinking" model (Qwen3) behave for structured work:
//   • think:false  — kill the reasoning phase so it doesn't burn the whole token
//     budget on <think> and return an empty answer.
//   • format:<schema>  — Ollama grammar-constrains output to an exact JSON shape,
//     so a small model can't emit valid-but-wrong JSON or narrate its reasoning.
// See adapters/ollama_gateway.py in the Python backend for the same lesson.

const OLLAMA_BASE = process.env.OLLAMA_BASE_URL || 'http://localhost:11434'
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'qwen3:4b'

export function localLLMEnabled() {
  return process.env.DOMAIN_EXPERT_LOCAL === '1'
}

// Gemini-format body → Ollama /api/chat messages (system + turns).
function toOllamaMessages(geminiBody) {
  const { contents = [], systemInstruction } = geminiBody
  const messages = []
  if (systemInstruction) {
    const sysText = systemInstruction.parts?.map((p) => p.text || '').join('') || ''
    if (sysText) messages.push({ role: 'system', content: sysText })
  }
  messages.push(...contents.map((c) => ({
    role: c.role === 'model' ? 'assistant' : 'user',
    content: c.parts?.map((p) => p.text || '').join('') || '',
  })))
  return messages
}

/**
 * Call the local Ollama model.
 * @param {object} geminiBody - same body shape passed to callGemini
 * @param {object} opts
 *   opts.schema      - JSON Schema object → grammar-forced structured output
 *   opts.json        - true → plain "valid JSON" mode (prompt drives the keys)
 *   opts.extractField- when set, parse the JSON and return obj[field] as the text
 * @returns {Promise<{ok:boolean,status:number,data:object}>}
 */
export async function callOllama(geminiBody, opts = {}) {
  const { generationConfig = {} } = geminiBody
  const body = {
    model: OLLAMA_MODEL,
    messages: toOllamaMessages(geminiBody),
    stream: false,
    think: false,
    options: {
      temperature: generationConfig.temperature ?? 0.7,
      num_predict: generationConfig.maxOutputTokens ?? 1024,
    },
  }
  if (opts.schema) body.format = opts.schema
  else if (opts.json) body.format = 'json'

  let data
  try {
    const res = await fetch(`${OLLAMA_BASE}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    data = await res.json().catch(() => ({}))
    if (!res.ok) {
      return { ok: false, status: res.status, data: { error: { message: data?.error || `Ollama error ${res.status}` } } }
    }
  } catch (e) {
    return { ok: false, status: 503, data: { error: { message: `Ollama unreachable at ${OLLAMA_BASE}: ${e.message}` } } }
  }

  let text = (data?.message?.content || '').trim()
  // Structured question path: unwrap {"question":"..."} → the spoken line.
  if (opts.extractField && text) {
    try {
      const obj = JSON.parse(text)
      if (obj && typeof obj[opts.extractField] === 'string') text = obj[opts.extractField].trim()
    } catch { /* leave text as-is; caller still gets something */ }
  }
  return { ok: true, status: 200, data: { candidates: [{ content: { parts: [{ text }] } }] } }
}

// Schema for the presenter/question path — forces a single clean spoken line.
export const QUESTION_SCHEMA = {
  type: 'object',
  properties: { question: { type: 'string' } },
  required: ['question'],
}
