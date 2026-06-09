import { NextResponse } from 'next/server'
import { callGemini, callGeminiStream, textFrom, stripJsonFences } from '@/lib/gemini'
import { query } from '@/lib/db'

const baseSystemPrompt = (role, jobDescription, resumeText) => `You are Iris, JobStream's AI interviewer. You're warm, sharp, and conversational — like a senior recruiter who genuinely wants to understand the candidate. You're conducting a short screening interview for the role of "${role}".${
  jobDescription
    ? `\n\nJOB DESCRIPTION (use this to make questions specific and relevant — focus on the skills, responsibilities, and seniority signals it implies):\n${jobDescription}`
    : ''
}${
  resumeText
    ? `\n\nCANDIDATE RESUME (use this to personalize questions — probe specific bullets, dig into claimed experience, ask about gaps relative to the JD):\n${resumeText}`
    : ''
}

Style:
- Ask ONE question per turn. Keep questions clear and conversational, 1-3 sentences.
- When you spot something specific in the candidate's resume that maps to the JD, ask about it by name (e.g., "I see you worked on X — how did you handle Y?").
- If the resume has gaps relative to the JD, probe them politely.
- Tailor follow-ups to the candidate's previous answers when relevant.
- Cover a mix of: background/experience, role-specific competency, problem-solving, and motivation.
- Do not add preambles like "Great question!" or restate the candidate's answer. Just ask the next question.
- Do not number the questions.`

const questionPrompt = (role, jobDescription, resumeText, count, total) =>
  `${baseSystemPrompt(role, jobDescription, resumeText)}

You have asked ${count} of ${total} planned questions. Produce the next question only. Output plain text, just the question itself, no quotes, no labels.`

const reportPrompt = (role, name, jobDescription, resumeText) =>
  `${baseSystemPrompt(role, jobDescription, resumeText)}

The interview is complete. Based on the conversation${resumeText ? ', the resume,' : ''} and the job description, produce a screening report for "${name || 'the candidate'}" applying for "${role}".

For the "rubric" field: extract the 4-6 most important skills/competencies from the JOB DESCRIPTION (e.g., "React expertise", "Performance debugging", "Mentorship", "Communication"). For each, score 1-5 based on transcript${resumeText ? ' + resume' : ''} evidence, and cite the specific evidence in one sentence. Use score 0 if no evidence was gathered.

Output STRICT JSON only (no markdown, no code fences), matching this shape exactly:
{
  "score": <integer 1-10>,
  "recommendation": "strong_yes" | "yes" | "maybe" | "no",
  "summary": "<2-3 sentence overall assessment>",
  "strengths": ["<short bullet>", "<short bullet>", "<short bullet>"],
  "concerns": ["<short bullet>", "<short bullet>"],
  "highlight_quote": "<one short verbatim or paraphrased line from the candidate that best captures their fit>",
  "rubric": [
    {"skill": "<skill from JD>", "score": <integer 0-5>, "evidence": "<one sentence citing transcript/resume>"}
  ]
}`

function toGeminiContents(messages, leadingInstruction) {
  const contents = []
  let first = true
  for (const m of messages) {
    const role = m.role === 'assistant' ? 'model' : 'user'
    let text = m.content
    if (first && role === 'user' && leadingInstruction) {
      text = `${leadingInstruction}\n\nCandidate: ${text}`
      first = false
    }
    contents.push({ role, parts: [{ text }] })
  }
  if (first && leadingInstruction) {
    contents.unshift({ role: 'user', parts: [{ text: leadingInstruction }] })
  }
  return contents
}

export async function POST(req) {
  try {
    const { action, candidate, messages = [], totalQuestions = 5, jobId, resumeText: resumeFromBody } = await req.json()

    let role = candidate?.role || 'the role'
    let jobDescription = ''
    if (jobId) {
      const r = await query(`SELECT role, description FROM interview_jobs WHERE id = $1`, [jobId])
      if (r.rowCount > 0) {
        role = r.rows[0].role
        jobDescription = r.rows[0].description
      }
    }
    const name = candidate?.name || ''
    const resumeText = resumeFromBody || candidate?.resumeText || ''

    if (action === 'report') {
      const instruction = reportPrompt(role, name, jobDescription, resumeText)
      const contents = toGeminiContents(messages, instruction)
      const result = await callGemini({
        contents,
        generationConfig: {
          temperature: 0.4,
          maxOutputTokens: 2500,
          thinkingConfig: { thinkingBudget: 0 },
        },
      })
      if (!result.ok) {
        console.error('Gemini error:', result.data)
        return NextResponse.json(
          { error: result.data?.error?.message || 'Gemini API error' },
          { status: result.status }
        )
      }
      const text = textFrom(result.data)
      try {
        const report = JSON.parse(stripJsonFences(text))
        return NextResponse.json({ report })
      } catch {
        return NextResponse.json({ report: null, raw: text }, { status: 200 })
      }
    }

    // action === 'question' — stream the response so text appears as it's generated
    const answeredCount = messages.filter((m) => m.role === 'user').length
    const instruction = questionPrompt(role, jobDescription, resumeText, answeredCount, totalQuestions)
    const contents = toGeminiContents(messages, instruction)
    const generationConfig = {
      temperature: 0.8,
      maxOutputTokens: 400,
      thinkingConfig: { thinkingBudget: 0 },
    }

    let streamRes
    try {
      streamRes = await callGeminiStream({ contents, generationConfig })
    } catch (streamErr) {
      // Fall back to non-streaming if stream setup fails
      console.warn('Gemini stream setup failed, falling back:', streamErr.message)
      const result = await callGemini({ contents, generationConfig })
      if (!result.ok) {
        return NextResponse.json(
          { error: result.data?.error?.message || 'Gemini API error' },
          { status: result.status }
        )
      }
      return NextResponse.json({ question: textFrom(result.data) })
    }

    const encoder = new TextEncoder()
    const readable = new ReadableStream({
      async start(controller) {
        const reader = streamRes.body.getReader()
        const decoder = new TextDecoder()
        let buf = ''
        try {
          while (true) {
            const { done, value } = await reader.read()
            if (done) break
            buf += decoder.decode(value, { stream: true })
            const lines = buf.split('\n')
            buf = lines.pop() // keep incomplete line
            for (const line of lines) {
              if (!line.startsWith('data: ')) continue
              const json = line.slice(6).trim()
              if (!json || json === '[DONE]') continue
              try {
                const chunk = JSON.parse(json)
                const text = chunk.candidates?.[0]?.content?.parts?.[0]?.text || ''
                if (text) controller.enqueue(encoder.encode(text))
              } catch {}
            }
          }
          controller.close()
        } catch (e) {
          controller.error(e)
        }
      },
    })

    return new Response(readable, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'X-Content-Type-Options': 'nosniff',
        'Cache-Control': 'no-store',
      },
    })
  } catch (err) {
    console.error('interview route error:', err)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
