// AI scoring for open-ended assessment items (scenario_response, coding).
// Uses callGemini (with automatic Groq fallback) to score each rubric
// dimension 0..1 against the reference answer + anchors, then computes a
// weighted overall. Deterministic MCQ scoring stays in lib/assessment.js.
//
// Design goals:
//   - Never crash the request. Any failure → {score:null, ...scoring_failed}.
//   - Honest about limits: coding is AI code REVIEW, not sandbox execution.
//   - Evidence discipline mirrors app/api/interview/route.js: every dimension
//     score carries a one-sentence justification that quotes the candidate.

import { callGemini, textFrom, stripJsonFences } from './gemini'

const SCORER_MODEL = process.env.NEXT_PUBLIC_GEMINI_MODEL || 'gemini-2.5-flash'

// The candidate's answer text depends on item type.
function extractResponseText(item, rawResponse) {
  if (!rawResponse || typeof rawResponse !== 'object') return ''
  if (item.type === 'coding') {
    return String(rawResponse.code || rawResponse.text || '').trim()
  }
  // scenario_response and any other free-text type
  return String(rawResponse.text || rawResponse.code || '').trim()
}

function buildScoringPrompt(item, dimensions, responseText) {
  const isCoding = item.type === 'coding'
  const dimBlock = dimensions
    .map((d, i) => {
      const anchors = d.anchors || {}
      return `  ${i + 1}. "${d.name}" (weight ${d.weight})
       low  (score →0.0): ${anchors.low || 'n/a'}
       high (score →1.0): ${anchors.high || 'n/a'}`
    })
    .join('\n')

  const responseLabel = isCoding ? 'CANDIDATE CODE SUBMISSION' : 'CANDIDATE RESPONSE'
  const reviewNote = isCoding
    ? `\nIMPORTANT: There is NO code sandbox or autograder. You are performing an AI CODE REVIEW by reading the code — you are NOT executing it. Judge correctness by careful reading; do not claim you ran anything. Be explicit in your reasoning that this is a static review.\n`
    : ''

  return `You are a strict, calibrated technical assessor scoring one candidate response against a fixed rubric. Score honestly against real-world hiring bars — the average competent candidate scores around 0.5 on each dimension; reserve 0.85+ for genuinely strong, evidence-backed answers.
${reviewNote}
━━━ ITEM PROMPT (what the candidate was asked) ━━━
${item.prompt}

━━━ REFERENCE ANSWER (expected direction — candidate need not match verbatim) ━━━
${item.reference_answer || '(none provided)'}

━━━ RUBRIC DIMENSIONS (score EACH 0.0–1.0) ━━━
${dimBlock}

━━━ ${responseLabel} ━━━
${responseText || '(empty response)'}

━━━ RULES ━━━
- Score EACH dimension on a continuous 0.0–1.0 scale using the low/high anchors.
- For each dimension, give a ONE-sentence "evidence" justification that QUOTES a short exact snippet from the candidate's response (verbatim). If the response is empty or the dimension is not addressed at all, score it low and say so in the evidence.
- Set "quote_verified" true only if your evidence snippets are copied verbatim from the response above.
- "overall_reasoning": 1–2 sentences summarizing the overall judgment.
- Do NOT reward confident-sounding filler with no substance.

━━━ OUTPUT (STRICT JSON — no markdown, no code fences) ━━━
{
  "dimension_scores": [
    { "name": "<exact dimension name>", "score": <0.0-1.0>, "evidence": "<one sentence quoting the response>" }
    // one object per rubric dimension, same order
  ],
  "overall_reasoning": "<1-2 sentences>",
  "quote_verified": true | false
}`
}

// Compute the weighted overall from per-dimension scores, aligning by name to
// the rubric weights. Falls back to equal weighting if names don't line up.
function weightedOverall(dimensions, dimScores) {
  let sumW = 0
  let acc = 0
  let matched = 0
  for (const d of dimensions) {
    const found = dimScores.find(
      (s) => String(s.name || '').toLowerCase().trim() === String(d.name || '').toLowerCase().trim()
    )
    const w = Number(d.weight)
    if (!found || !Number.isFinite(Number(found.score)) || !Number.isFinite(w)) continue
    const s = Math.max(0, Math.min(1, Number(found.score)))
    acc += s * w
    sumW += w
    matched++
  }
  if (sumW > 0 && matched > 0) return { overall: acc / sumW, matched }

  // Fallback: simple mean of whatever scores we got.
  const valid = dimScores
    .map((s) => Number(s.score))
    .filter((n) => Number.isFinite(n))
    .map((n) => Math.max(0, Math.min(1, n)))
  if (valid.length === 0) return { overall: null, matched: 0 }
  return { overall: valid.reduce((a, b) => a + b, 0) / valid.length, matched: 0 }
}

// Main entry: AI-score a scenario_response or coding item.
// Returns { score, score_confidence, ai_evaluation }. Never throws.
export async function scoreOpenEnded(item, rawResponse) {
  const rubric = item.scoring_rubric || {}
  const dimensions = Array.isArray(rubric.dimensions) ? rubric.dimensions : []
  const responseText = extractResponseText(item, rawResponse)

  // Guard: no rubric dimensions → we can't score meaningfully.
  if (dimensions.length === 0) {
    return {
      score: null,
      score_confidence: 0.0,
      ai_evaluation: { status: 'scoring_failed', error: 'no_rubric_dimensions' },
    }
  }

  // Guard: empty response → deterministic zero (no need to spend an LLM call).
  if (!responseText) {
    return {
      score: 0,
      score_confidence: 1.0,
      ai_evaluation: {
        dimension_scores: dimensions.map((d) => ({
          name: d.name,
          score: 0,
          evidence: 'No response submitted.',
        })),
        overall_reasoning: 'Candidate submitted an empty response.',
        quote_verified: true,
        method: item.type === 'coding' ? 'ai_code_review' : 'ai_rubric_scoring',
        model: SCORER_MODEL,
      },
    }
  }

  const prompt = buildScoringPrompt(item, dimensions, responseText)

  let result
  try {
    result = await callGemini({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 2000,
        thinkingConfig: { thinkingBudget: 0 },
      },
    })
  } catch (e) {
    return {
      score: null,
      score_confidence: 0.0,
      ai_evaluation: { status: 'scoring_failed', error: `llm_call_failed: ${e.message}` },
    }
  }

  if (!result || !result.ok) {
    return {
      score: null,
      score_confidence: 0.0,
      ai_evaluation: {
        status: 'scoring_failed',
        error: result?.data?.error?.message || `llm_error_${result?.status || 'unknown'}`,
      },
    }
  }

  let parsed
  try {
    parsed = JSON.parse(stripJsonFences(textFrom(result.data)))
  } catch (e) {
    return {
      score: null,
      score_confidence: 0.0,
      ai_evaluation: { status: 'scoring_failed', error: `json_parse_failed: ${e.message}` },
    }
  }

  const dimScores = Array.isArray(parsed?.dimension_scores) ? parsed.dimension_scores : []
  if (dimScores.length === 0) {
    return {
      score: null,
      score_confidence: 0.0,
      ai_evaluation: { status: 'scoring_failed', error: 'no_dimension_scores_returned' },
    }
  }

  const { overall, matched } = weightedOverall(dimensions, dimScores)
  if (overall == null) {
    return {
      score: null,
      score_confidence: 0.0,
      ai_evaluation: { status: 'scoring_failed', error: 'no_valid_dimension_scores' },
    }
  }

  // Confidence: high when all dimensions matched by name and quotes verified;
  // lower when we had to fall back to name-agnostic averaging or quotes unverified.
  const coverage = dimensions.length > 0 ? matched / dimensions.length : 0
  const quoteVerified = parsed?.quote_verified === true
  let confidence = 0.5 + 0.35 * coverage + (quoteVerified ? 0.15 : 0)
  confidence = Math.max(0, Math.min(1, confidence))

  return {
    score: Math.max(0, Math.min(1, overall)),
    score_confidence: Number(confidence.toFixed(2)),
    ai_evaluation: {
      dimension_scores: dimScores.map((s) => ({
        name: s.name,
        score: Number.isFinite(Number(s.score)) ? Math.max(0, Math.min(1, Number(s.score))) : null,
        evidence: String(s.evidence || ''),
      })),
      overall_reasoning: String(parsed.overall_reasoning || ''),
      quote_verified: quoteVerified,
      method: item.type === 'coding' ? 'ai_code_review_no_execution' : 'ai_rubric_scoring',
      model: SCORER_MODEL,
    },
  }
}

export { SCORER_MODEL }
