// Saving finished AI interviews. Called only by /api/interview after the
// server has written the report itself (see lib/interview-record.js).

import { query } from './db.js'
import { callGemini, textFrom, stripJsonFences } from './gemini.js'
import { scoreTranscriptEnsemble } from './eie-rate.js'
import { finalizeReport } from './expert-rubric.js'

function fitPrompt(jobDescription, role, transcript, resumeText) {
  const flat = transcript
    .map((m) => `${m.role === 'user' ? 'Candidate' : 'Interviewer'}: ${m.content}`)
    .join('\n')
  return `You are evaluating how well a candidate's screening interview matches a specific job description.

ROLE: ${role}

JOB DESCRIPTION:
${jobDescription}
${resumeText ? `\nCANDIDATE RESUME:\n${resumeText}\n` : ''}
INTERVIEW TRANSCRIPT:
${flat}

Score the candidate's fit for THIS specific job (not generic interview performance). Weigh evidence from BOTH their resume AND their interview answers: relevant experience, technical depth in the areas the JD calls for, seniority signals, and motivation alignment.

Output STRICT JSON only (no markdown, no code fences):
{
  "job_fit_score": <integer 0-100>,
  "fit_reasoning": "<2-3 sentences explaining the score, citing specific evidence from the resume and/or transcript>"
}`
}

// An Iris job interview: job-fit score against this job's description, the
// competency profile, then one row in interview_candidates.
export async function saveJobInterview({ job, userId, name, email, transcript, report, resumeText }) {
  const fit = { job_fit_score: null, fit_reasoning: null }
  const result = await callGemini({
    contents: [{ role: 'user', parts: [{ text: fitPrompt(job.description, job.role, transcript, resumeText) }] }],
    generationConfig: { temperature: 0.3, maxOutputTokens: 600, thinkingConfig: { thinkingBudget: 0 } },
  })
  if (result.ok) {
    try {
      const parsed = JSON.parse(stripJsonFences(textFrom(result.data)))
      if (typeof parsed.job_fit_score === 'number') fit.job_fit_score = Math.max(0, Math.min(100, Math.round(parsed.job_fit_score)))
      if (typeof parsed.fit_reasoning === 'string') fit.fit_reasoning = parsed.fit_reasoning
    } catch (e) {
      console.warn('Fit-score parse failed:', e.message)
    }
  } else {
    console.warn('Fit-score call failed:', result.data?.error?.message)
  }

  // Competency profile (same rubric as Maya). A failure still saves the report.
  let enriched = report
  try {
    const { profile } = await scoreTranscriptEnsemble({ role: job.role || 'the role', messages: transcript, nRaters: 2, name })
    if (profile) enriched = { ...(report || {}), eie: profile }
  } catch {}

  const { rows } = await query(
    `INSERT INTO interview_candidates (job_id, name, email, transcript, report, job_fit_score, fit_reasoning, resume_text, user_id)
     VALUES ($1, $2, $3, $4::jsonb, $5::jsonb, $6, $7, $8, $9)
     RETURNING id`,
    [job.id, name, email || null, JSON.stringify(transcript), enriched ? JSON.stringify(enriched) : null,
      fit.job_fit_score, fit.fit_reasoning, resumeText || null, userId]
  )
  return { id: rows[0].id }
}

// A Maya expert interview: the score is recomputed from the rubric, then the
// competency profile is added and one row goes into expert_assessments.
export async function saveExpertInterview({ userId, domain, transcript, report: rawReport, evasions = 0 }) {
  const report = finalizeReport(rawReport)
  if (transcript.length > 0) {
    try {
      const { profile } = await scoreTranscriptEnsemble({ role: domain || 'the role', messages: transcript, nRaters: 2, evasions })
      if (profile) report.eie = profile
    } catch {}
  }
  const { rows } = await query(
    `INSERT INTO expert_assessments (candidate_user_id, domain, transcript, report, expertise_score, expertise_level)
     VALUES ($1, $2, $3::jsonb, $4::jsonb, $5, $6)
     RETURNING id, created_at`,
    [userId, domain || null, JSON.stringify(transcript), JSON.stringify(report),
      Number.isFinite(report.expertise_score) ? report.expertise_score : null, report.expertise_level || null]
  )
  return { id: rows[0].id, report }
}
