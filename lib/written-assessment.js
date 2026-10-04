// Written assessment runtime: sections, timers, the frozen per-candidate form,
// answer checking, and the report. Used by /api/assessment/* when a session
// has a form (sessions from the older 6-random-item flow have none and keep
// using lib/assessment.js).
//
// Rules the server enforces (the browser is never trusted):
//   - a session is reached only with its access token or by its own logged-in
//     candidate;
//   - an answer is accepted only for the item currently shown;
//   - each section has a deadline (plus a short grace); after it the remaining
//     items in that section are recorded as unanswered and the test moves on;
//   - answer keys, hidden tests and per-item scores never reach the candidate.
// Keyed items (mcq, multi_select, sjt) are scored on submit. Coding and code
// review are scored once at the end, in parallel, so the candidate is not kept
// waiting between questions.

import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'
import { query } from './db'
import { logEvent, updateSkillGraph } from './assessment'
import {
  getBlueprint, drawForm, formIsUsable, roleFamilyFor, LANGUAGES, TRACKS, LEVELS,
  SECTION_GRACE_S, BLUEPRINT_VERSION,
} from './assessment-blueprint.js'
import { scoreKeyedItem, scoreCoding, scoreCodeReview, SCORER_MODEL_LABEL } from './written-scoring.js'
import { scoreOpenEnded } from './assessment-scoring'
import { callGemini, textFrom, stripJsonFences } from './gemini.js'
import { callOllama, localLLMEnabled } from './ollama.js'
import { availableLanguages } from './code-runner.js'
import { summariseResponses } from './written-report.js'

export class AssessmentError extends Error {
  constructor(message, status = 400, code = 'bad_request') {
    super(message)
    this.status = status
    this.code = code
  }
}

const KEYED = new Set(['mcq', 'multi_select', 'sjt'])
const ITEM_COLUMNS = `id, type, format, section, language, tracks, levels, primary_skill_code,
  secondary_skill_codes, prompt, content, scoring_rubric, reference_answer, expected_time_s`

const sha256 = (s) => createHash('sha256').update(s).digest('hex')

// ── Session access ────────────────────────────────────────────────────────

export async function loadSession(sessionId) {
  if (!/^[0-9a-f-]{36}$/i.test(String(sessionId || ''))) throw new AssessmentError('session not found', 404, 'not_found')
  const { rows } = await query(
    `SELECT id, candidate_user_id, role_family, seniority_band, framework_version, track, language,
            state, started_at, completed_at, time_limit_s, job_id, form, progress,
            access_token_hash, final_report_id
     FROM assessment_sessions WHERE id = $1`,
    [sessionId]
  )
  if (rows.length === 0) throw new AssessmentError('session not found', 404, 'not_found')
  return rows[0]
}

export function canAccess(session, { token, userId }) {
  if (userId && session.candidate_user_id && userId === session.candidate_user_id) return true
  if (!token || !session.access_token_hash) return false
  const a = Buffer.from(sha256(String(token)))
  const b = Buffer.from(session.access_token_hash)
  return a.length === b.length && timingSafeEqual(a, b)
}

// ── Start ─────────────────────────────────────────────────────────────────

export function startOptions() {
  return {
    tracks: Object.entries(TRACKS).map(([key, t]) => ({ key, label: t.label, available: t.available })),
    levels: Object.entries(LEVELS).map(([key, l]) => ({ key, label: l.label })),
    languages: availableLanguages().map((key) => ({ key, label: LANGUAGES[key].label })),
  }
}

export async function createSession({ candidateUserId, track, level, language, jobId, disabledSections, userAgent }) {
  if (!TRACKS[track]?.available) throw new AssessmentError(`the ${track} assessment is not available yet`)
  if (!LEVELS[level]) throw new AssessmentError('unknown level')
  if (!availableLanguages().includes(language)) throw new AssessmentError('that coding language is not available')

  const blueprint = getBlueprint({ track, level, disabledSections })
  const { rows: bank } = await query(
    `SELECT id, type, format, language, tracks, levels, primary_skill_code, content, tags
     FROM items
     WHERE status = 'live' AND section IS NOT NULL AND $1 = ANY(tracks) AND $2 = ANY(levels)`,
    [track, level]
  )
  const seed = randomBytes(4).readUInt32LE(0)
  const form = drawForm(blueprint, bank, { language, seed })
  if (!formIsUsable(form)) {
    throw new AssessmentError('this assessment does not have enough questions yet', 409, 'bank_too_small')
  }

  const token = randomBytes(24).toString('hex')
  const timeLimitS = form.sections.reduce((a, s) => a + s.minutes * 60 + SECTION_GRACE_S, 0)
  const progress = { version: 0, section: 0, item: 0, sectionStartedAt: null }
  const { rows } = await query(
    `INSERT INTO assessment_sessions
       (candidate_user_id, role_family, seniority_band, framework_version, target_skill_codes,
        time_limit_s, job_id, metadata, track, language, form, progress, access_token_hash)
     VALUES ($1, $2, $3, $4, '{}', $5, $6, $7::jsonb, $8, $9, $10::jsonb, $11::jsonb, $12)
     RETURNING id`,
    [
      candidateUserId || null, roleFamilyFor(track), level, BLUEPRINT_VERSION, timeLimitS, jobId || null,
      JSON.stringify({ userAgent: userAgent || null, blueprint }),
      track, language, JSON.stringify(form), JSON.stringify(progress), sha256(token),
    ]
  )
  const sessionId = rows[0].id
  await logEvent(sessionId, 'session_started', {
    track, level, language, seed, sections: form.sections.map((s) => ({ key: s.key, n: s.items.length })),
    shortfall: form.shortfall,
  }, 'system')
  return { sessionId, token }
}

// ── State ─────────────────────────────────────────────────────────────────

function deadlineOf(section, progress) {
  if (!progress.sectionStartedAt) return null
  return new Date(progress.sectionStartedAt).getTime() + section.minutes * 60 * 1000
}

async function saveProgress(session, next) {
  const { rowCount } = await query(
    `UPDATE assessment_sessions SET progress = $2::jsonb
     WHERE id = $1 AND state = 'in_progress' AND (progress->>'version')::int = $3`,
    [session.id, JSON.stringify({ ...next, version: session.progress.version + 1 }), session.progress.version]
  )
  if (rowCount === 0) throw new AssessmentError('the test was updated in another tab; reload to continue', 409, 'conflict')
  session.progress = { ...next, version: session.progress.version + 1 }
}

function sectionSummary(form) {
  return form.sections.map((s) => ({ key: s.key, label: s.label, minutes: s.minutes, count: s.items.length }))
}

function candidateItem(row, entry, language) {
  const c = row.content || {}
  const itemLanguage = LANGUAGES[language].itemLanguage
  const out = {
    id: row.id,
    type: row.type,
    format: row.format,
    prompt: row.prompt,
    expectedTimeS: row.expected_time_s,
  }
  if (Array.isArray(c.choices)) {
    out.choices = (entry.order || c.choices.map((_, i) => i)).map((i) => c.choices[i])
  }
  if (row.type === 'coding') {
    out.functionName = c.function_name?.[itemLanguage]
    out.starter = c.starter?.[itemLanguage] || ''
    out.visibleTests = (c.visible_tests || []).map((t) => ({ name: t.name, calls: t.calls }))
  }
  if (c.code_by_language) {
    out.code = c.code_by_language[itemLanguage] || c.code_by_language.javascript
    out.codeLanguage = c.code_by_language[itemLanguage] ? itemLanguage : 'javascript'
  }
  return out
}

async function loadItem(itemId) {
  const { rows } = await query(`SELECT ${ITEM_COLUMNS} FROM items WHERE id = $1`, [itemId])
  if (rows.length === 0) throw new AssessmentError('item missing from bank', 500, 'item_missing')
  return rows[0]
}

// Close the current section if its time is up: remaining items are recorded
// as unanswered (score 0). Loops in case several sections expired while the
// candidate was away (only the running section can expire; later sections
// have not started).
async function expireIfDue(session) {
  if (session.state !== 'in_progress') return false
  const { form, progress } = session
  const section = form.sections[progress.section]
  const deadline = deadlineOf(section, progress)
  if (!deadline || Date.now() <= deadline + SECTION_GRACE_S * 1000) return false
  const remaining = section.items.slice(progress.item)
  await saveProgress(session, { section: progress.section + 1, item: 0, sectionStartedAt: null })
  for (const entry of remaining) {
    await recordResponse(session, entry, section.key, { skipped: true, reason: 'time_up' }, null,
      { score: 0, score_confidence: 1, ai_evaluation: { unanswered: true, reason: 'time_up' } })
  }
  await logEvent(session.id, 'section_timed_out', { section: section.key, unanswered: remaining.length }, 'system')
  if (session.progress.section >= form.sections.length) await completeSession(session, 'time_up')
  return true
}

// What the candidate should see now.
export async function getState(session) {
  await expireIfDue(session)
  if (session.state !== 'in_progress') {
    return { status: 'completed', sections: sectionSummary(session.form) }
  }
  const { form, progress } = session
  if (progress.section >= form.sections.length) {
    await completeSession(session, 'all_answered')
    return { status: 'completed', sections: sectionSummary(form) }
  }
  const section = form.sections[progress.section]
  const base = {
    sections: sectionSummary(form),
    sectionIndex: progress.section,
    section: { key: section.key, label: section.label, minutes: section.minutes, count: section.items.length },
    language: session.language,
  }
  if (!progress.sectionStartedAt) return { status: 'section_intro', ...base }
  const entry = section.items[progress.item]
  const row = await loadItem(entry.itemId)
  return {
    status: 'in_progress',
    ...base,
    itemIndex: progress.item,
    sectionEndsAt: new Date(deadlineOf(section, progress)).toISOString(),
    item: candidateItem(row, entry, session.language),
  }
}

export async function beginSection(session) {
  await expireIfDue(session)
  if (session.state === 'in_progress' && !session.progress.sectionStartedAt) {
    await saveProgress(session, { ...session.progress, sectionStartedAt: new Date().toISOString() })
    const section = session.form.sections[session.progress.section]
    await logEvent(session.id, 'section_started', { section: section.key }, 'candidate')
  }
  return getState(session)
}

// ── Answers ───────────────────────────────────────────────────────────────

async function recordResponse(session, entry, sectionKey, raw, timeSpentMs, scored) {
  const { rows: seqRows } = await query(
    `SELECT COALESCE(MAX(seq), 0) + 1 AS next FROM item_responses WHERE session_id = $1`,
    [session.id]
  )
  const { rows } = await query(
    `INSERT INTO item_responses
       (session_id, item_id, candidate_user_id, seq, raw_response, score, score_confidence,
        ai_evaluation, time_spent_ms, section)
     VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7, $8::jsonb, $9, $10)
     RETURNING id`,
    [
      session.id, entry.itemId, session.candidate_user_id, seqRows[0].next, JSON.stringify(raw || {}),
      scored ? scored.score : null, scored ? scored.score_confidence : null,
      JSON.stringify(scored ? scored.ai_evaluation : { status: 'pending_end_of_test' }),
      Number.isFinite(timeSpentMs) ? Math.max(0, Math.round(timeSpentMs)) : null, sectionKey,
    ]
  )
  await query(`UPDATE items SET n_administered = n_administered + 1 WHERE id = $1`, [entry.itemId])
  return rows[0].id
}

// Keep only the fields each type needs, and cap sizes.
function cleanResponse(type, response) {
  const r = response && typeof response === 'object' ? response : {}
  if (type === 'mcq' || type === 'sjt') return { choice: Number.isInteger(r.choice) ? r.choice : null }
  if (type === 'multi_select') {
    return { choices: Array.isArray(r.choices) ? r.choices.filter(Number.isInteger).slice(0, 10) : [] }
  }
  if (type === 'coding') return { code: String(r.code || '').slice(0, 50000) }
  return { text: String(r.text || '').slice(0, 20000) }
}

export async function submitAnswer(session, { itemId, response, timeSpentMs }) {
  if (await expireIfDue(session)) {
    return { ...(await getState(session)), notice: 'section_time_up' }
  }
  if (session.state !== 'in_progress') throw new AssessmentError('the test is already finished', 409, 'finished')
  const { form, progress } = session
  if (!progress.sectionStartedAt) throw new AssessmentError('this section has not started', 409, 'not_started')
  const section = form.sections[progress.section]
  const entry = section.items[progress.item]
  if (entry.itemId !== itemId) throw new AssessmentError('that is not the current question; reload to continue', 409, 'wrong_item')

  // Claim the step first so a double submit cannot record two answers.
  const lastInSection = progress.item + 1 >= section.items.length
  await saveProgress(session, lastInSection
    ? { section: progress.section + 1, item: 0, sectionStartedAt: null }
    : { ...progress, item: progress.item + 1 })

  const row = await loadItem(itemId)
  const raw = cleanResponse(row.type, response)
  let scored = null
  if (KEYED.has(row.type)) {
    scored = scoreKeyedItem(row, raw, entry.order)
  }
  const responseId = await recordResponse(session, entry, section.key, raw, timeSpentMs, scored)
  if (scored && session.candidate_user_id) {
    await updateSkillGraph(session.candidate_user_id, row, { id: responseId, score: scored.score, raw_response: raw, ai_evaluation: scored.ai_evaluation })
  }
  await logEvent(session.id, 'response_received', { itemId, section: section.key }, 'candidate')

  if (session.progress.section >= form.sections.length) {
    await completeSession(session, 'all_answered')
    return { status: 'completed', sections: sectionSummary(form) }
  }
  return getState(session)
}

// ── Completion: deferred scoring + report ─────────────────────────────────

async function completeSession(session, reason) {
  const { rowCount } = await query(
    `UPDATE assessment_sessions SET state = 'submitted', completed_at = now()
     WHERE id = $1 AND state = 'in_progress'`,
    [session.id]
  )
  session.state = 'submitted'
  if (rowCount === 0) return
  await logEvent(session.id, 'session_completed', { reason }, 'system')
  try {
    await scorePending(session)
    const report = await generateWrittenReport(session.id)
    await logEvent(session.id, 'report_generated', { reportId: report.reportId, overall: report.overall }, 'system')
  } catch (e) {
    console.error('written assessment report failed:', e)
    await logEvent(session.id, 'report_failed', { error: e.message }, 'system').catch(() => {})
  }
}

async function scorePending(session) {
  const { rows } = await query(
    `SELECT ir.id AS response_id, ir.raw_response, ${ITEM_COLUMNS.split(',').map((c) => `i.${c.trim()}`).join(', ')}
     FROM item_responses ir JOIN items i ON i.id = ir.item_id
     WHERE ir.session_id = $1 AND ir.score IS NULL AND NOT (ir.raw_response ? 'skipped')`,
    [session.id]
  )
  await Promise.allSettled(rows.map(async (r) => {
    let scored
    if (r.type === 'coding') scored = await scoreCoding(r, r.raw_response, { language: session.language })
    else if (r.type === 'code_review') scored = await scoreCodeReview(r, r.raw_response, { language: session.language })
    else if (r.type === 'scenario_response') scored = await scoreOpenEnded(r, r.raw_response)
    else return
    await query(
      `UPDATE item_responses SET score = $2, score_confidence = $3, ai_evaluation = $4::jsonb WHERE id = $1`,
      [r.response_id, scored.score, scored.score_confidence, JSON.stringify(scored.ai_evaluation || {})]
    )
    if (scored.score != null && session.candidate_user_id) {
      await updateSkillGraph(session.candidate_user_id, r, { id: r.response_id, score: scored.score, raw_response: r.raw_response, ai_evaluation: scored.ai_evaluation })
    }
  }))
}

async function narrative(context) {
  const prompt = `You write a short, factual summary of a candidate's written technical assessment for a hiring team.
Use ONLY the results below. Do not invent anything. If evidence is thin, say so.

${context}

Return STRICT JSON only:
{"summary": "<2-3 sentences>", "strengths": ["<specific>", "<specific>"], "concerns": ["<specific>", "<specific>"]}`
  const body = {
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: { temperature: 0.2, maxOutputTokens: 1200, thinkingConfig: { thinkingBudget: 0 } },
  }
  const result = localLLMEnabled() ? await callOllama(body, { json: true }) : await callGemini(body)
  if (!result?.ok) throw new Error(`llm_error_${result?.status}`)
  return JSON.parse(stripJsonFences(textFrom(result.data)))
}

export async function generateWrittenReport(sessionId) {
  const session = await loadSession(sessionId)
  const { rows: responses } = await query(
    `SELECT ir.id, ir.section, ir.score, ir.score_confidence, ir.raw_response, ir.ai_evaluation,
            i.type, i.primary_skill_code, i.secondary_skill_codes, i.prompt
     FROM item_responses ir JOIN items i ON i.id = ir.item_id
     WHERE ir.session_id = $1 ORDER BY ir.seq`,
    [sessionId]
  )
  const result = summariseResponses(session.form, responses)
  if (session.form.shortfall?.length) result.flags.push({ kind: 'short_form', detail: session.form.shortfall })

  let summary = null
  let strengths = []
  let concerns = []
  const modelVersions = { scorer: SCORER_MODEL_LABEL(), blueprint: BLUEPRINT_VERSION }
  try {
    const context = [
      `Track ${session.track}, level ${session.seniority_band}, language ${session.language}.`,
      `Overall ${result.overall}/100 (${result.band?.label || 'n/a'}).`,
      ...result.sections.map((s) => `Section "${s.label}": ${s.score ?? 'not scored'}/100, answered ${s.answered} of ${s.planned}.`),
      `Skills (score 0-1): ${result.skillMap.map((k) => `${k.skill}=${k.score} (${k.items} items)`).join('; ')}`,
      ...responses.filter((r) => r.type === 'coding').map((r) => `Coding: ${r.ai_evaluation?.tests?.passed ?? '?'}/${r.ai_evaluation?.tests?.total ?? '?'} tests passed. Quality note: ${r.ai_evaluation?.quality?.note || 'n/a'}`),
      ...responses.filter((r) => r.type === 'code_review').map((r) => `Code review: ${(r.ai_evaluation?.markers || []).map((m) => m.note).filter(Boolean).join(' / ') || 'n/a'}`),
    ].join('\n')
    const n = await narrative(context)
    summary = typeof n.summary === 'string' ? n.summary : null
    strengths = Array.isArray(n.strengths) ? n.strengths.map(String).slice(0, 4) : []
    concerns = Array.isArray(n.concerns) ? n.concerns.map(String).slice(0, 4) : []
  } catch (e) {
    modelVersions.narrative_error = e.message
  }

  const validation = {
    calibrated: false,
    note: 'Bands are uncalibrated until pilot data exists. This is a recommendation; the hiring team decides.',
    n_responses: responses.length,
    flags: result.flags,
  }
  const { rows } = await query(
    `INSERT INTO assessment_reports
       (session_id, candidate_user_id, framework_version, model_versions, skill_deltas, overall_score,
        recommendation, summary, strengths, concerns, validation, sections, band, skill_map)
     VALUES ($1, $2, $3, $4::jsonb, '[]'::jsonb, $5, $6, $7, $8::jsonb, $9::jsonb, $10::jsonb, $11::jsonb, $12, $13::jsonb)
     ON CONFLICT (session_id) DO UPDATE SET
       model_versions = EXCLUDED.model_versions, overall_score = EXCLUDED.overall_score,
       recommendation = EXCLUDED.recommendation, summary = EXCLUDED.summary,
       strengths = EXCLUDED.strengths, concerns = EXCLUDED.concerns, validation = EXCLUDED.validation,
       sections = EXCLUDED.sections, band = EXCLUDED.band, skill_map = EXCLUDED.skill_map, created_at = now()
     RETURNING id`,
    [
      sessionId, session.candidate_user_id, BLUEPRINT_VERSION, JSON.stringify(modelVersions),
      result.overall == null ? null : result.overall / 10, result.band?.recommendation || 'maybe',
      summary, JSON.stringify(strengths), JSON.stringify(concerns), JSON.stringify(validation),
      JSON.stringify(result.sections), result.band?.key || null, JSON.stringify(result.skillMap),
    ]
  )
  await query(`UPDATE assessment_sessions SET final_report_id = $1 WHERE id = $2`, [rows[0].id, sessionId])
  return { reportId: rows[0].id, overall: result.overall, band: result.band?.key || null }
}

// What a candidate sees after finishing: which sections went well, no numbers,
// no answers (items are reused for other candidates).
export async function candidateResult(session) {
  const { rows } = await query(
    `SELECT sections, band FROM assessment_reports WHERE session_id = $1`,
    [session.id]
  )
  if (rows.length === 0) return { status: session.state === 'in_progress' ? 'in_progress' : 'marking' }
  return {
    status: 'completed',
    sections: (rows[0].sections || []).map((s) => ({
      label: s.label,
      feedback: s.score == null ? 'Being reviewed' : s.score >= 70 ? 'A strong area' : s.score >= 50 ? 'Solid, with room to grow' : 'An area to work on',
    })),
  }
}
