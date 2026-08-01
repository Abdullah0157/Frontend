// Assessment engine — shared helpers used by the /api/assessment routes.
// Non-adaptive v1: random item selection weighted only by "not yet seen" and
// "matches target skills". Adaptive IRT-based selection is a follow-up.

import { query } from './db'
import { callGemini, textFrom, stripJsonFences } from './gemini'
import { scoreOpenEnded, SCORER_MODEL } from './assessment-scoring'

// Append an event to the session's event log. Auto-computes seq. Idempotent
// on (session_id, seq) — advisory locking not needed because Postgres will
// return the next serial and we compute seq here.
export async function logEvent(sessionId, type, payload, actor = 'system') {
  const { rows } = await query(
    `SELECT COALESCE(MAX(seq), 0) + 1 AS next FROM assessment_events WHERE session_id = $1`,
    [sessionId]
  )
  const seq = rows[0].next
  await query(
    `INSERT INTO assessment_events (session_id, seq, type, payload, actor)
     VALUES ($1, $2, $3, $4::jsonb, $5)`,
    [sessionId, seq, type, JSON.stringify(payload), actor]
  )
  return seq
}

// Pick the next item for a session. v1 = random from live items that:
//   - measure at least one of the session's target_skill_codes
//   - haven't been shown in this session yet
// Returns null when no more items are available (assessment ends).
export async function pickNextItem(sessionId) {
  const sess = await query(
    `SELECT target_skill_codes FROM assessment_sessions WHERE id = $1`,
    [sessionId]
  )
  if (sess.rowCount === 0) return null
  const targetSkills = sess.rows[0].target_skill_codes || []

  const { rows } = await query(
    `SELECT i.id, i.type, i.modality, i.primary_skill_code, i.secondary_skill_codes,
            i.prompt, i.scoring_rubric, i.expected_time_s
     FROM items i
     WHERE i.status = 'live'
       AND (
         $1::text[] = '{}'::text[]
         OR i.primary_skill_code = ANY($1)
         OR i.secondary_skill_codes && $1
       )
       AND NOT EXISTS (
         SELECT 1 FROM item_responses r
         WHERE r.session_id = $2 AND r.item_id = i.id
       )
     ORDER BY random()
     LIMIT 1`,
    [targetSkills, sessionId]
  )
  return rows[0] || null
}

// Score a response.
// - MCQ: deterministic correct-choice mapping (UNCHANGED).
// - scenario_response / coding: real AI scoring against the rubric via
//   lib/assessment-scoring.js (Gemini→Groq fallback). Coding is AI code
//   review only — there is no sandbox/autograder yet.
// Never throws: on AI failure the scorer returns {score:null, ...scoring_failed}.
export async function scoreResponse(item, rawResponse) {
  if (item.type === 'mcq') {
    const rubric = item.scoring_rubric || {}
    const choices = rubric.choices || []
    const picked = choices[rawResponse.choice_index]
    if (!picked) return { score: 0, score_confidence: 1.0, ai_evaluation: { reason: 'invalid_choice' } }
    if (picked.correct) return { score: 1.0, score_confidence: 1.0, ai_evaluation: { correct: true } }
    return {
      score: picked.partial || 0,
      score_confidence: 1.0,
      ai_evaluation: { correct: false, partial: picked.partial || 0 },
    }
  }

  if (item.type === 'scenario_response' || item.type === 'coding') {
    try {
      return await scoreOpenEnded(item, rawResponse || {})
    } catch (e) {
      return {
        score: null,
        score_confidence: 0.0,
        ai_evaluation: { status: 'scoring_failed', error: e.message || 'unexpected_scoring_error' },
      }
    }
  }

  // Other modalities (voice/video/system_design) not yet wired for async scoring.
  return {
    score: null,
    score_confidence: 0.0,
    ai_evaluation: { status: 'pending_ai_score', reason: `AI scorer not yet implemented for type '${item.type}'` },
  }
}

// Update the candidate's skill graph after a scored response. v1 uses a
// simple weighted-update (score maps to theta_delta) rather than proper
// Bayesian EAP — we upgrade this once we have calibrated items.
export async function updateSkillGraph(candidateUserId, item, response) {
  if (!candidateUserId || response.score == null) return

  const skillsToUpdate = [item.primary_skill_code, ...(item.secondary_skill_codes || [])]
  const primaryWeight = 1.0
  const secondaryWeight = 0.3

  for (const skillCode of skillsToUpdate) {
    const weight = skillCode === item.primary_skill_code ? primaryWeight : secondaryWeight

    // Get current state (or create with prior).
    const cur = await query(
      `SELECT theta, theta_se, n_responses FROM candidate_skill_state
       WHERE candidate_user_id = $1 AND skill_code = $2`,
      [candidateUserId, skillCode]
    )
    const prior = cur.rows[0] || { theta: 0, theta_se: 1.5, n_responses: 0 }

    // Simple update: score 0..1 → delta -1..+1, scaled by weight and inverse-sqrt-n.
    // As n grows the update magnitude shrinks (uncertainty narrows).
    const delta = (response.score - 0.5) * 2 * weight * (1 / Math.sqrt(prior.n_responses + 1))
    const newTheta = prior.theta + delta
    const newSe = Math.max(0.1, prior.theta_se * 0.85) // SE shrinks slowly per response
    const newN = prior.n_responses + 1
    const confidence = Math.min(1.0, newN / 10) * (1 - Math.min(0.95, newSe / 1.5))

    await query(
      `INSERT INTO candidate_skill_state (candidate_user_id, skill_code, theta, theta_se, confidence, n_responses, last_updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, now())
       ON CONFLICT (candidate_user_id, skill_code) DO UPDATE SET
         theta = EXCLUDED.theta,
         theta_se = EXCLUDED.theta_se,
         confidence = EXCLUDED.confidence,
         n_responses = EXCLUDED.n_responses,
         last_updated_at = now()`,
      [candidateUserId, skillCode, newTheta, newSe, confidence, newN]
    )

    await query(
      `INSERT INTO candidate_skill_transitions (candidate_user_id, skill_code, from_theta, to_theta, from_theta_se, to_theta_se, trigger_response_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [candidateUserId, skillCode, prior.theta, newTheta, prior.theta_se, newSe, response.id]
    )

    await query(
      `INSERT INTO candidate_skill_evidence (candidate_user_id, skill_code, item_response_id, evidence_type, evidence_weight, quote, ai_reasoning)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        candidateUserId, skillCode, response.id,
        response.score >= 0.7 ? 'demonstrated' : response.score <= 0.3 ? 'contradicted' : 'partial',
        weight,
        String(response.raw_response?.text || '').slice(0, 200) || null,
        (response.ai_evaluation && JSON.stringify(response.ai_evaluation).slice(0, 500)) || null,
      ]
    )
  }
}

// Should the session stop? v1 = fixed length + time budget.
export async function shouldStop(sessionId, maxItems = 6) {
  const { rows } = await query(
    `SELECT
       (SELECT COUNT(*)::int FROM item_responses WHERE session_id = $1) AS n,
       (SELECT EXTRACT(EPOCH FROM (now() - started_at))::int FROM assessment_sessions WHERE id = $1) AS elapsed_s,
       (SELECT time_limit_s FROM assessment_sessions WHERE id = $1) AS limit_s`,
    [sessionId]
  )
  const r = rows[0] || {}
  if ((r.n || 0) >= maxItems) return { stop: true, reason: 'max_items' }
  if ((r.elapsed_s || 0) >= (r.limit_s || 1800)) return { stop: true, reason: 'time_limit' }
  return { stop: false }
}

// ─── Report generation ────────────────────────────────────────────────────
// Builds an immutable-ish assessment_reports row when a session completes.
// - overall_score: mean of scored responses (0..1) rescaled to 0..10.
// - recommendation: derived from overall_score.
// - summary/strengths/concerns: LLM-written, grounded in the ACTUAL per-item
//   scores + evidence (strict JSON, evidence discipline per interview route).
// Wrapped in defensive parsing so a report never breaks the respond flow.
// Uses ON CONFLICT (session_id) DO UPDATE and sets sessions.final_report_id.
function recommendationFor(score10) {
  if (score10 == null) return 'maybe'
  if (score10 >= 8) return 'strong_yes'
  if (score10 >= 6.5) return 'yes'
  if (score10 >= 5) return 'maybe'
  return 'no'
}

const reportPrompt = (roleFamily, seniorityBand, overall10, itemBlocks) => `You are writing an internal assessment summary for the hiring committee for a ${seniorityBand || ''} ${roleFamily} candidate. The candidate completed an adaptive skills assessment. Below is EVERY scored item with its computed score (0.0–1.0) and the per-dimension AI evidence.

━━━ STRICT EVIDENCE RULES (violating any = report rejected) ━━━
1. Ground EVERY strength and concern in the per-item scores/evidence below. Do NOT invent facts not present in the evidence.
2. If evidence is thin, say so honestly rather than fabricating.
3. Be calibrated: the mean score maps to ${overall10}/10 overall. Do not contradict that with an overly rosy or overly harsh narrative.
4. MINIMUM 2 concerns and MINIMUM 2 strengths. Every candidate has both.

━━━ PER-ITEM RESULTS ━━━
${itemBlocks}

━━━ OUTPUT (STRICT JSON — no markdown, no code fences) ━━━
{
  "summary": "<2-3 sentences specific to THIS candidate's demonstrated skills. Ban generic filler ('strong candidate', 'good communicator'). Reference concrete evidence.>",
  "strengths": ["<one specific, evidence-grounded strength>", "<another>"],
  "concerns": ["<one specific, evidence-grounded concern or gap>", "<another>"]
}`

export async function generateReport(sessionId) {
  // 1. Load session.
  const { rows: sessRows } = await query(
    `SELECT id, candidate_user_id, role_family, seniority_band, framework_version
     FROM assessment_sessions WHERE id = $1`,
    [sessionId]
  )
  if (sessRows.length === 0) throw new Error('session not found for report')
  const session = sessRows[0]

  // 2. Load all item_responses (with item metadata) for this session.
  const { rows: responses } = await query(
    `SELECT ir.id, ir.seq, ir.score, ir.score_confidence, ir.ai_evaluation, ir.raw_response,
            i.type, i.primary_skill_code, i.prompt
     FROM item_responses ir
     JOIN items i ON ir.item_id = i.id
     WHERE ir.session_id = $1
     ORDER BY ir.seq`,
    [sessionId]
  )

  // 3. Skill deltas — transitions triggered by this session's responses.
  const responseIds = responses.map((r) => r.id)
  let skillDeltas = []
  if (responseIds.length > 0) {
    const { rows: transitions } = await query(
      `SELECT skill_code, from_theta, to_theta, from_theta_se, to_theta_se, trigger_response_id, ts
       FROM candidate_skill_transitions
       WHERE trigger_response_id = ANY($1::uuid[])
       ORDER BY ts`,
      [responseIds]
    )
    skillDeltas = transitions.map((t) => ({
      skill: t.skill_code,
      from_theta: t.from_theta,
      to_theta: t.to_theta,
      from_theta_se: t.from_theta_se,
      to_theta_se: t.to_theta_se,
      evidence_refs: [t.trigger_response_id],
    }))
  }

  // 4. Overall score = mean of scored responses (0..1) → 0..10.
  const scored = responses.filter((r) => r.score != null && Number.isFinite(Number(r.score)))
  const meanScore = scored.length > 0
    ? scored.reduce((a, r) => a + Number(r.score), 0) / scored.length
    : null
  const overall10 = meanScore == null ? null : Number((meanScore * 10).toFixed(1))
  const recommendation = recommendationFor(overall10)

  // 5. LLM narrative grounded in the actual per-item evidence.
  const itemBlocks = responses.map((r) => {
    const ev = r.ai_evaluation || {}
    const dims = Array.isArray(ev.dimension_scores)
      ? ev.dimension_scores.map((d) => `      - ${d.name}: ${d.score == null ? 'n/a' : Number(d.score).toFixed(2)} — ${d.evidence || ''}`).join('\n')
      : '      (deterministic/MCQ or no dimension breakdown)'
    const scoreStr = r.score == null ? 'UNSCORED' : Number(r.score).toFixed(2)
    return `[Item ${r.seq}] type=${r.type} skill=${r.primary_skill_code} score=${scoreStr}
    prompt: ${String(r.prompt || '').slice(0, 200)}
    reasoning: ${ev.overall_reasoning || ev.reason || ev.status || 'n/a'}
    dimensions:
${dims}`
  }).join('\n\n')

  let summary = null
  let strengths = []
  let concerns = []
  const modelVersions = { llm_scorer: SCORER_MODEL, report_writer: SCORER_MODEL }

  try {
    const result = await callGemini({
      contents: [{ role: 'user', parts: [{ text: reportPrompt(session.role_family, session.seniority_band, overall10, itemBlocks) }] }],
      generationConfig: { temperature: 0.2, maxOutputTokens: 2000, thinkingConfig: { thinkingBudget: 0 } },
    })
    if (result?.ok) {
      const parsed = JSON.parse(stripJsonFences(textFrom(result.data)))
      summary = typeof parsed.summary === 'string' ? parsed.summary : null
      strengths = Array.isArray(parsed.strengths) ? parsed.strengths : []
      concerns = Array.isArray(parsed.concerns) ? parsed.concerns : []
    } else {
      modelVersions.report_writer_error = result?.data?.error?.message || `llm_error_${result?.status}`
    }
  } catch (e) {
    // Narrative generation failed — still write the structured/quantitative report.
    modelVersions.report_writer_error = `report_narrative_failed: ${e.message}`
  }

  // 6. Validation block — quantitative honesty layer.
  const validation = {
    n_responses: responses.length,
    n_scored: scored.length,
    n_unscored: responses.length - scored.length,
    mean_score_0_1: meanScore == null ? null : Number(meanScore.toFixed(3)),
    scored_coverage: responses.length > 0 ? Number((scored.length / responses.length).toFixed(2)) : 0,
    skill_transitions: skillDeltas.length,
    narrative_generated: summary != null,
  }

  // 7. Upsert the report.
  const { rows: repRows } = await query(
    `INSERT INTO assessment_reports
       (session_id, candidate_user_id, framework_version, model_versions,
        skill_deltas, overall_score, recommendation, summary,
        strengths, concerns, validation)
     VALUES ($1, $2, $3, $4::jsonb, $5::jsonb, $6, $7, $8, $9::jsonb, $10::jsonb, $11::jsonb)
     ON CONFLICT (session_id) DO UPDATE SET
       candidate_user_id = EXCLUDED.candidate_user_id,
       framework_version = EXCLUDED.framework_version,
       model_versions    = EXCLUDED.model_versions,
       skill_deltas      = EXCLUDED.skill_deltas,
       overall_score     = EXCLUDED.overall_score,
       recommendation    = EXCLUDED.recommendation,
       summary           = EXCLUDED.summary,
       strengths         = EXCLUDED.strengths,
       concerns          = EXCLUDED.concerns,
       validation        = EXCLUDED.validation,
       created_at        = now()
     RETURNING id`,
    [
      sessionId, session.candidate_user_id, session.framework_version,
      JSON.stringify(modelVersions),
      JSON.stringify(skillDeltas),
      overall10, recommendation, summary,
      JSON.stringify(strengths), JSON.stringify(concerns),
      JSON.stringify(validation),
    ]
  )
  const reportId = repRows[0].id

  // 8. Link the session to its report.
  await query(
    `UPDATE assessment_sessions SET final_report_id = $1 WHERE id = $2`,
    [reportId, sessionId]
  )

  return { reportId, overallScore: overall10, recommendation }
}
