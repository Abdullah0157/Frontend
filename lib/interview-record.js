// The server's own record of an AI interview (Iris for a job, Maya for a
// candidate's expertise). The browser sends its copy of the conversation on
// every turn, but the conversation a report is built from is the one kept
// here: each question as the server asked it, each answer as it arrived. So a
// conversation cannot be rewritten at the end, and a report is always written
// by the server, never accepted from the browser.

import { query } from './db.js'

export class InterviewError extends Error {
  constructor(message, status = 400) {
    super(message)
    this.status = status
  }
}

const UUID = /^[0-9a-f-]{36}$/i
const MAX_ANSWER_CHARS = 8000

// This caller's session, created on first use. Someone else's session, a
// session for another interview, or a finished one is refused.
export async function openSession({ sessionId, userId, jobId = null }) {
  if (!UUID.test(String(sessionId || ''))) throw new InterviewError('missing interview session', 400)
  await query(
    `INSERT INTO interview_sessions (id, job_id, user_id) VALUES ($1, $2, $3) ON CONFLICT (id) DO NOTHING`,
    [sessionId, jobId, userId]
  )
  // A session the interview prep step made before the owner was known.
  await query(`UPDATE interview_sessions SET user_id = $1 WHERE id = $2 AND user_id IS NULL`, [userId, sessionId])
  const { rows } = await query(
    `SELECT id, job_id, user_id, messages, status FROM interview_sessions WHERE id = $1`,
    [sessionId]
  )
  const s = rows[0]
  if (!s || s.user_id !== userId) throw new InterviewError('this interview belongs to someone else', 403)
  if ((s.job_id || null) !== (jobId || null)) throw new InterviewError('this interview session is for a different interview', 400)
  if (s.status !== 'in_progress') throw new InterviewError('this interview is already finished', 409)
  return { ...s, messages: Array.isArray(s.messages) ? s.messages : [] }
}

// The conversation the server goes by: its own record, plus the latest answer
// from the browser's copy when that answer follows the last question asked.
// Earlier turns always come from the record, whatever the browser sends.
export function conversation(record, sent) {
  const turns = Array.isArray(record) ? record : []
  const last = Array.isArray(sent) ? sent[sent.length - 1] : null
  const answer = last?.role === 'user' && typeof last.content === 'string' && last.content.trim()
    ? { role: 'user', content: last.content.slice(0, MAX_ANSWER_CHARS) }
    : null
  if (answer && turns[turns.length - 1]?.role === 'assistant') return [...turns, answer]
  return turns
}

// Store the conversation so far plus the question just asked.
export async function recordQuestion(sessionId, turns, question) {
  await query(
    `UPDATE interview_sessions SET messages = $1::jsonb, updated_at = now() WHERE id = $2 AND status = 'in_progress'`,
    [JSON.stringify([...turns, { role: 'assistant', content: String(question).trim() }]), sessionId]
  )
}

export async function finishSession(sessionId, turns) {
  await query(
    `UPDATE interview_sessions SET messages = $1::jsonb, status = 'completed', completed_at = now(), updated_at = now() WHERE id = $2`,
    [JSON.stringify(turns), sessionId]
  )
}

// What a candidate sees of their own job interview: what went well and what to
// practise. The score, the hiring recommendation, concerns and risk notes are
// for the hiring team only.
export function candidateView(report) {
  const r = report || {}
  const strengths = (Array.isArray(r.strengths) ? r.strengths : [])
    .map((s) => (typeof s === 'string' ? s : s?.claim))
    .filter((s) => typeof s === 'string' && s.trim())
    .slice(0, 3)
  const practise = (Array.isArray(r.rubric) ? r.rubric : [])
    .filter((x) => typeof x?.skill === 'string' && Number.isFinite(Number(x.score)))
    .sort((a, b) => Number(a.score) - Number(b.score))
    .slice(0, 2)
    .map((x) => x.skill)
  return { strengths, practise }
}

// ── Attempts ──────────────────────────────────────────────────────────────
// The expert interview (Maya) may be taken twice; a job's AI interview (Iris)
// once. An attempt counts as soon as the first question is asked, so quitting
// halfway does not give a fresh start. The admin can give one more attempt
// (interview_attempt_grants) for real technical problems.
export const ATTEMPTS = { expert: 2, job: 1 }

export async function attemptStatus(userId, jobId = null) {
  const job = jobId || null
  const { rows } = await query(
    `SELECT
       (SELECT count(*)::int FROM interview_sessions
         WHERE user_id = $1 AND job_id IS NOT DISTINCT FROM $2::uuid
           AND (jsonb_array_length(messages) > 0 OR status <> 'in_progress')) AS started,
       (CASE WHEN $2::uuid IS NULL
          THEN (SELECT count(*)::int FROM expert_assessments WHERE candidate_user_id = $1)
          ELSE (SELECT count(*)::int FROM interview_candidates WHERE user_id = $1 AND job_id = $2::uuid) END) AS finished,
       (SELECT count(*)::int FROM interview_attempt_grants WHERE user_id = $1 AND job_id IS NOT DISTINCT FROM $2::uuid) AS extra`,
    [userId, job]
  )
  const r = rows[0]
  // Interviews saved before attempts were counted have no session; count them too.
  const used = Math.max(r.started, r.finished)
  const allowed = (job ? ATTEMPTS.job : ATTEMPTS.expert) + r.extra
  return { used, allowed, left: Math.max(0, allowed - used) }
}

// ── Leaving the interview ─────────────────────────────────────────────────
// The page reports each time the candidate left (another tab or window, or out
// of full screen) and came back. Leaving three times, or more than 30 seconds
// away in total, ends the interview; either way it goes in the report.
export const FOCUS_LIMITS = { leaves: 3, awaySeconds: 30 }
const MAX_FOCUS_EVENTS = 100

export function cleanFocusEvents(events) {
  return (Array.isArray(events) ? events : [])
    .slice(0, 20)
    .map((e) => ({ kind: e?.kind === 'back' ? 'back' : e?.kind === 'left' ? 'left' : null, ms: Math.max(0, Math.min(3600000, Math.round(Number(e?.ms) || 0))) }))
    .filter((e) => e.kind)
}

export async function recordFocusEvents(sessionId, events) {
  const clean = cleanFocusEvents(events)
  if (clean.length === 0) return
  await query(
    `UPDATE interview_sessions SET focus_events = focus_events || $1::jsonb
     WHERE id = $2 AND jsonb_array_length(focus_events) < ${MAX_FOCUS_EVENTS}`,
    [JSON.stringify(clean), sessionId]
  )
}

// What goes in the report for the hiring team.
export function focusSummary(events, endedReason = null) {
  const list = Array.isArray(events) ? events : []
  const leaves = list.filter((e) => e.kind === 'left').length
  const awaySeconds = Math.round(list.filter((e) => e.kind === 'back').reduce((a, e) => a + e.ms, 0) / 1000)
  const notes = []
  if (leaves > 0) notes.push(`Left the interview ${leaves} time(s), ${awaySeconds} seconds in total (another tab or window, or out of full screen).`)
  if (endedReason === 'left') notes.push('The interview was ended early because they kept leaving it.')
  return { level: notes.length ? 'review' : 'clear', leaves, away_seconds: awaySeconds, ended_early: endedReason === 'left', notes }
}
