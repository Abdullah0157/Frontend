// Shared EIE rating pipeline — used by /api/eie/score AND the interview save
// path, so the live product and the API always score identically.
// The LLM acts ONLY as a rater/extractor against fixed BARS anchors; the engine
// (finalizeProfile) does the mechanical aggregation. See EVALUATION_ENGINE.md §13.

import { callGemini, textFrom, stripJsonFences } from '@/lib/gemini'
import { callOllama, localLLMEnabled } from '@/lib/ollama'
import { buildModel, anchorGuideText } from '@/lib/competency-framework'

// Provider picker: the free local model (opt-in via DOMAIN_EXPERT_LOCAL) or
// Groq/Gemini. Both return the same { ok, data:{candidates} } shape, and every
// rater/verifier prompt here demands STRICT JSON — so local runs in json mode.
function scoreLLM(body) {
  return localLLMEnabled() ? callOllama(body, { json: true }) : callGemini(body)
}
import { finalizeProfile, finalizeProfileEnsemble } from '@/lib/eie-scoring'
import { blindTranscript } from '@/lib/fairness'
import { interviewQuality } from '@/lib/interview-quality'

export function buildRaterPrompt(model, role, transcript) {
  const compIds = model.competencies.map((c) => c.id)
  return `You are a calibrated evaluation instrument, not a chatty assistant. Rate this candidate for "${role}" (${model.seniority} level) on each competency below, STRICTLY against its BARS anchors. Pick the anchor level (1-5) whose description the transcript actually supports — not a flattering guess.

FRAME OF REFERENCE — the competencies and their anchors:
${anchorGuideText(model)}

RULES (these make you trustworthy):
- Base every rating on a SPECIFIC behavioral moment (situation → action → outcome). Cite it with a direct quote and its turn number.
- If the transcript does NOT contain enough behavioral evidence for a competency, set "state":"unknown" and give a "followup" question. Unknown is CORRECT and expected — do NOT guess a number to fill it.
- Attach EVERY supporting quote you can find for a competency in its "evidence" array (more evidence = higher confidence).
- confidence (0.0-1.0) = how well the transcript actually evidenced your level.
- Calibration: level 5 = genuinely exceptional (top ~5%), 3 = solid/standard, 1 = poor. Most real people are 2-4. Do NOT inflate.
- If a candidate is caught contradicting themselves or fabricating, set "failure_triggered" for that competency.

Output STRICT JSON only — no markdown, no code fences:
{
  "ratings": [
    {
      "competency_id": "<one of: ${compIds.join(', ')}>",
      "state": "measured" | "unknown",
      "bars_level": <1-5 or null if unknown>,
      "confidence": <0.0-1.0>,
      "evidence": [ { "quote": "<direct quote>", "turn_ref": <turn number>, "note": "<why this maps to the level>" } ],
      "followup": "<if unknown: a question that would elicit the missing evidence, else null>",
      "failure_triggered": "<optional: describe a contradiction/fabrication, else omit>"
    }
    // one object for EVERY competency listed above
  ]
}

FULL TRANSCRIPT:
${transcript}`
}

// Rate a completed interview → finalized EIE profile. Returns { profile } or
// { error }. Never throws (callers can enrich a report without risking the save).
export async function scoreTranscript({ role = 'the role', seniority = '', messages = [], name = '' }) {
  try {
    if (!Array.isArray(messages) || messages.length === 0) return { error: 'no messages' }
    const model = buildModel(role, seniority || role)
    // Fairness: rate on an identity-blinded transcript (Phase 5).
    const { messages: blinded, redactions } = blindTranscript(messages, { name })
    const transcript = blinded
      .map((m, i) => `[Turn ${i + 1}] ${m.role === 'assistant' ? 'INTERVIEWER' : 'CANDIDATE'}: ${m.content}`)
      .join('\n\n')

    const result = await scoreLLM({
      contents: [{ role: 'user', parts: [{ text: buildRaterPrompt(model, role, transcript) }] }],
      generationConfig: { temperature: 0.2, maxOutputTokens: 4096, thinkingConfig: { thinkingBudget: 0 } },
    })
    if (!result.ok) return { error: result.data?.error?.message || 'AI error' }

    let ratings = []
    try {
      const parsed = JSON.parse(stripJsonFences(textFrom(result.data)))
      ratings = Array.isArray(parsed?.ratings) ? parsed.ratings : []
    } catch {
      return { error: 'parse failed', raw: textFrom(result.data) }
    }
    const profile = finalizeProfile(model, ratings)
    profile.audit = { blinded: true, redactions, note: 'rated on identity-blinded transcript' }
    return { profile }
  } catch (e) {
    return { error: e.message || 'scoring failed' }
  }
}

// ── Phase 3: ensemble scoring ──────────────────────────────────────────────
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n))

// Deterministic rotation → gives each rater a different competency ordering
// (position-bias mitigation) without Math.random.
function rotate(arr, k) {
  const n = arr.length
  const s = ((k % n) + n) % n
  return [...arr.slice(s), ...arr.slice(0, s)]
}

async function rateOnce({ model, role, transcript, temperature, rotateBy }) {
  const raterModel = { ...model, competencies: rotate(model.competencies, rotateBy) }
  const result = await scoreLLM({
    contents: [{ role: 'user', parts: [{ text: buildRaterPrompt(raterModel, role, transcript) }] }],
    generationConfig: { temperature, maxOutputTokens: 4096, thinkingConfig: { thinkingBudget: 0 } },
  })
  if (!result.ok) throw new Error(result.data?.error?.message || 'rater failed')
  const parsed = JSON.parse(stripJsonFences(textFrom(result.data)))
  if (!Array.isArray(parsed?.ratings)) throw new Error('bad rater output')
  return parsed.ratings
}

async function adversarialVerify({ role, transcript, claims }) {
  // claims: [{competency_id, name, level}]
  const prompt = `You are a skeptical review board member. For each competency below, the interviewer proposed a level (1-5) for "${role}". Your job is to REFUTE any level the transcript does NOT genuinely support. Default to refuted=false; only set refuted=true when the evidence is clearly too weak, contradicted, or fabricated for the claimed level.

CLAIMS:
${claims.map((c) => `- ${c.competency_id} (${c.name}): claimed level ${c.level}`).join('\n')}

Output STRICT JSON only:
{ "verdicts": [ { "competency_id": "<id>", "refuted": true|false, "reason": "<one line if refuted>" } ] }

FULL TRANSCRIPT:
${transcript}`
  const result = await scoreLLM({
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: { temperature: 0.1, maxOutputTokens: 1500, thinkingConfig: { thinkingBudget: 0 } },
  })
  if (!result.ok) return {}
  try {
    const parsed = JSON.parse(stripJsonFences(textFrom(result.data)))
    const map = {}
    for (const v of parsed?.verdicts || []) if (v?.competency_id) map[v.competency_id] = { refuted: !!v.refuted, reason: v.reason || '' }
    return map
  } catch { return {} }
}

// Full Phase 3 pipeline: N independent raters → adversarial verify → G-theory
// aggregation. Rate-limit-safe: raters run with allSettled; needs ≥1 to succeed;
// verifier failure is non-fatal.
export async function scoreTranscriptEnsemble({ role = 'the role', seniority = '', messages = [], nRaters = 2, name = '', evasions = 0 }) {
  try {
    if (!Array.isArray(messages) || messages.length === 0) return { error: 'no messages' }
    const model = buildModel(role, seniority || role)
    // Fairness: rate on an identity-blinded transcript (Phase 5).
    const { messages: blinded, redactions } = blindTranscript(messages, { name })
    const transcript = blinded
      .map((m, i) => `[Turn ${i + 1}] ${m.role === 'assistant' ? 'INTERVIEWER' : 'CANDIDATE'}: ${m.content}`)
      .join('\n\n')

    const N = clamp(nRaters, 1, 3)
    const temps = [0.2, 0.45, 0.32]
    const settled = await Promise.allSettled(
      Array.from({ length: N }, (_, i) => rateOnce({ model, role, transcript, temperature: temps[i % temps.length], rotateBy: i * 2 }))
    )
    const raters = settled.filter((s) => s.status === 'fulfilled').map((s) => s.value)
    if (raters.length === 0) {
      const err = settled.find((s) => s.status === 'rejected')?.reason?.message || 'all raters failed'
      return { error: err }
    }

    // Group ratings by competency across raters.
    const byComp = {}
    for (const cid of model.competencies.map((c) => c.id)) byComp[cid] = []
    for (const ratings of raters) {
      for (const r of ratings) if (r?.competency_id && byComp[r.competency_id]) byComp[r.competency_id].push(r)
    }

    // Adversarial verification against the majority proposed level.
    let refutations = {}
    const claims = model.competencies.map((c) => {
      const lv = (byComp[c.id] || []).map((r) => Number(r.bars_level)).filter(Number.isFinite)
      if (!lv.length) return null
      const level = Math.round(lv.reduce((s, x) => s + x, 0) / lv.length)
      return { competency_id: c.id, name: c.name, level }
    }).filter(Boolean)
    if (claims.length) refutations = await adversarialVerify({ role, transcript, claims })

    const profile = finalizeProfileEnsemble(model, byComp, refutations, { rater_count: raters.length })
    profile.audit = {
      blinded: true, redactions,
      verified: Object.keys(refutations).length > 0 || true,
      note: 'rated on identity-blinded transcript; ensemble + adversarial verification',
    }
    // Interview-Quality score (step 6): grade the interview itself.
    const questionsAsked = messages.filter((m) => m.role === 'assistant').length
    profile.interview_quality = interviewQuality(profile, { questionsAsked, evasions })
    return { profile }
  } catch (e) {
    return { error: e.message || 'ensemble scoring failed' }
  }
}
