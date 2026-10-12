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

// One AI interview per job: a finished one cannot be taken again.
export async function jobInterviewDone(jobId, userId) {
  const { rows } = await query(`SELECT 1 FROM interview_candidates WHERE job_id = $1 AND user_id = $2 LIMIT 1`, [jobId, userId])
  return rows.length > 0
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
