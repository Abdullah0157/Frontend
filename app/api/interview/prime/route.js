import { NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { callGemini, textFrom, stripJsonFences } from '@/lib/gemini'

export const runtime = 'nodejs'

const FALLBACK = {
  keySkills: [],
  gapAreas: [],
  questionFocus: ['background and experience', 'role-specific skills', 'problem solving approach', 'motivation'],
  seniority: 'mid',
  totalQuestions: 5,
}

export async function POST(req) {
  let jobId, resumeText, sessionId
  try {
    ;({ jobId, resumeText, sessionId } = await req.json())
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (!jobId || !resumeText || !sessionId) {
    return NextResponse.json({ error: 'jobId, resumeText, and sessionId are required' }, { status: 400 })
  }

  try {
    const { rows } = await query(
      `SELECT role, description FROM interview_jobs WHERE id = $1`,
      [jobId]
    )
    if (rows.length === 0) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 })
    }
    const { description: jobDescription } = rows[0]

    const geminiRes = await callGemini({
      contents: [
        {
          role: 'user',
          parts: [
            {
              text: `Analyze this job description and candidate resume for an AI screening interview.

JOB DESCRIPTION:
${jobDescription}

CANDIDATE RESUME:
${resumeText}

Output STRICT JSON only, no markdown, no code fences:
{
  "keySkills": ["<top 4-6 skills required by JD>"],
  "gapAreas": ["<skills in JD not evidenced in resume, max 3>"],
  "questionFocus": ["<4-6 specific interview topics based on JD requirements and resume gaps>"],
  "seniority": "junior|mid|senior|lead",
  "totalQuestions": <integer 5 for junior/mid, 6 for senior, 7 for lead>
}`,
            },
          ],
        },
      ],
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: 600,
        thinkingConfig: { thinkingBudget: 0 },
      },
    })

    if (!geminiRes.ok) {
      console.error('Gemini prime failed:', geminiRes.status, geminiRes.data)
      return NextResponse.json({ primedContext: FALLBACK })
    }

    const raw = textFrom(geminiRes.data)
    let primedContext
    try {
      primedContext = JSON.parse(stripJsonFences(raw))
    } catch {
      console.error('Gemini prime: JSON parse failed. Raw:', raw)
      return NextResponse.json({ primedContext: FALLBACK })
    }

    try {
      await query(
        `INSERT INTO interview_sessions (id, job_id, primed_context, total_questions, messages)
         VALUES ($1, $2, $3::jsonb, $4, '[]'::jsonb)
         ON CONFLICT (id) DO UPDATE SET primed_context = EXCLUDED.primed_context, updated_at = now()`,
        [sessionId, jobId, JSON.stringify(primedContext), primedContext.totalQuestions]
      )
    } catch (dbErr) {
      console.warn('interview_sessions upsert skipped:', dbErr.message)
    }

    return NextResponse.json({ primedContext })
  } catch (e) {
    console.error('Prime route error:', e)
    return NextResponse.json({ primedContext: FALLBACK })
  }
}
