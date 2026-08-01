import { NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { callGemini, textFrom, stripJsonFences } from '@/lib/gemini'
import { getSupabaseServer } from '@/lib/supabase/server'
import { scoreTranscriptEnsemble } from '@/lib/eie-rate'

export const dynamic = 'force-dynamic'

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

export async function POST(req, { params }) {
  try {
    const { id: jobId } = params
    const { name, email, transcript, report, resumeText } = await req.json()

    if (!name?.trim() || !Array.isArray(transcript) || transcript.length === 0) {
      return NextResponse.json({ error: 'name and transcript are required' }, { status: 400 })
    }

    // Capture the logged-in candidate so their AI-interview completion can be
    // detected on the application hub (job_id + user_id).
    let candidateUserId = null
    try {
      const supabase = getSupabaseServer()
      const { data: { user } } = await supabase.auth.getUser()
      candidateUserId = user?.id || null
    } catch {}

    const jobRes = await query(`SELECT id, role, description FROM interview_jobs WHERE id = $1`, [jobId])
    if (jobRes.rowCount === 0) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 })
    }
    const job = jobRes.rows[0]

    // Second Gemini call: re-score the transcript against THIS job's description.
    let fit = { job_fit_score: null, fit_reasoning: null }
    const result = await callGemini({
      contents: [{ role: 'user', parts: [{ text: fitPrompt(job.description, job.role, transcript, resumeText) }] }],
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: 600,
        thinkingConfig: { thinkingBudget: 0 },
      },
    })
    if (result.ok) {
      try {
        const parsed = JSON.parse(stripJsonFences(textFrom(result.data)))
        if (typeof parsed.job_fit_score === 'number') {
          fit.job_fit_score = Math.max(0, Math.min(100, Math.round(parsed.job_fit_score)))
        }
        if (typeof parsed.fit_reasoning === 'string') fit.fit_reasoning = parsed.fit_reasoning
      } catch (e) {
        console.warn('Fit-score parse failed:', e.message)
      }
    } else {
      console.warn('Fit-score Gemini call failed:', result.data?.error?.message)
    }

    // Enrich the Iris report with the EIE competency profile + decision +
    // interview-quality (same rigorous rubric as Maya). Non-fatal: a scoring
    // failure still saves the base report.
    let enrichedReport = report
    try {
      const { profile } = await scoreTranscriptEnsemble({ role: job.role || 'the role', messages: transcript, nRaters: 2, name })
      if (profile) enrichedReport = { ...(report || {}), eie: profile }
    } catch {}

    const { rows } = await query(
      `INSERT INTO interview_candidates (job_id, name, email, transcript, report, job_fit_score, fit_reasoning, resume_text, user_id)
       VALUES ($1, $2, $3, $4::jsonb, $5::jsonb, $6, $7, $8, $9)
       RETURNING id, name, job_fit_score, fit_reasoning, created_at`,
      [
        jobId,
        name.trim(),
        email?.trim() || null,
        JSON.stringify(transcript),
        enrichedReport ? JSON.stringify(enrichedReport) : null,
        fit.job_fit_score,
        fit.fit_reasoning,
        resumeText || null,
        candidateUserId,
      ]
    )

    return NextResponse.json({ candidate: rows[0] }, { status: 201 })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
