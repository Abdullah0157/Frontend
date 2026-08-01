import { NextResponse } from 'next/server'

export async function POST(req) {
  try {
    const key = process.env.GROQ_API_KEY
    if (!key) return NextResponse.json({ error: 'No GROQ_API_KEY' }, { status: 500 })

    const formData = await req.formData()
    const audio = formData.get('audio')
    if (!audio) return NextResponse.json({ error: 'No audio' }, { status: 400 })

    // Optional domain context from the client → conditions Whisper so it spells
    // domain-specific terms (frameworks, tools, jargon) correctly. Kept short.
    const context = String(formData.get('context') || '').slice(0, 800)
    const prompt = context
      ? `Interview about ${context}. Transcribe the spoken English answer verbatim, including technical terms.`
      : 'Interview answer in clear spoken English. Transcribe verbatim.'

    const groqForm = new FormData()
    groqForm.append('file', audio)
    groqForm.append('model', 'whisper-large-v3')
    groqForm.append('language', 'en')
    groqForm.append('response_format', 'json')
    groqForm.append('prompt', prompt)
    groqForm.append('temperature', '0')

    const res = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}` },
      body: groqForm,
    })

    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      console.error('Whisper error:', err)
      return NextResponse.json({ error: err?.error?.message || 'Whisper error' }, { status: res.status })
    }

    const data = await res.json()
    return NextResponse.json({ text: data.text?.trim() || '' })
  } catch (e) {
    console.error('STT route error:', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
