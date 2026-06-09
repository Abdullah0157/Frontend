'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import InterviewExperience from '@/components/InterviewExperience'
import PermissionGate from '@/components/PermissionGate'
import { primeTTS, playTestChime } from '@/lib/tts'
import { playServerTTS } from '@/lib/tts-client'

export default function JobInterviewFromAggregator() {
  const { id } = useParams()
  const [externalJob, setExternalJob] = useState(null)
  const [loadingJob, setLoadingJob] = useState(true)
  const [error, setError] = useState('')

  const [form, setForm] = useState({ name: '', email: '' })
  const [file, setFile] = useState(null)
  const [resumeText, setResumeText] = useState('')
  const [prepared, setPrepared] = useState(null) // { job, candidate, resumeText }
  const [preparing, setPreparing] = useState(false)
  const [audioTested, setAudioTested] = useState(false)
  const [proctorStreams, setProctorStreams] = useState(null) // { cameraStream, screenStream }
  const [savedResume, setSavedResume] = useState(null) // { resume_text, full_name } from /api/profile

  function testAudio() {
    primeTTS()
    const chimeOk = playTestChime()
    playServerTTS('Hi! If you can hear this, your audio is working perfectly. Click Start Interview when you are ready.', {
      onEnd: () => setAudioTested(true),
      onError: () => setAudioTested(chimeOk),
    })
  }

  useEffect(() => {
    async function load() {
      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL
        const res = await fetch(`${apiUrl}/jobs/${id}`)
        if (!res.ok) throw new Error(`Could not load job (${res.status})`)
        const data = await res.json()
        setExternalJob(data)
      } catch (e) {
        setError(e.message)
      } finally {
        setLoadingJob(false)
      }
    }
    if (id) load()
  }, [id])

  // Pre-fetch saved resume so we can skip the upload step if the user already has one.
  useEffect(() => {
    fetch('/api/profile', { method: 'POST' })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.resume_text) {
          setSavedResume(data)
          if (!form.name && data.full_name) setForm((f) => ({ ...f, name: data.full_name }))
        }
      })
      .catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleStart(e) {
    e.preventDefault()
    if (!form.name.trim()) return
    if (!savedResume && !file) return
    primeTTS()
    playServerTTS(`Hi ${form.name}, I'm Iris. Give me one moment, then we'll start the interview.`)
    setError('')
    setPreparing(true)
    try {
      // 1. Resume: use saved if available, otherwise parse the uploaded PDF
      let resume
      if (savedResume?.resume_text) {
        resume = savedResume.resume_text
      } else {
        const fd = new FormData()
        fd.append('file', file)
        const parseRes = await fetch('/api/upload-resume', { method: 'POST', body: fd })
        if (!parseRes.ok) {
          const j = await parseRes.json().catch(() => ({}))
          throw new Error(j.error || 'Failed to parse resume')
        }
        const parsed = await parseRes.json()
        resume = parsed.text
        // Save to profile for next time
        fetch('/api/profile', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            full_name: form.name,
            resume_text: resume,
            resume_filename: file.name,
            resume_pages: parsed.pages,
            resume_chars: parsed.chars,
          }),
        }).catch(() => {})
      }

      // 2. Ensure an internal interview_jobs row exists for this aggregated job
      const ensureRes = await fetch('/api/jobs/from-external', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          externalId: String(externalJob.id ?? id),
          title: externalJob.title,
          company: externalJob.company,
          role: externalJob.title,
          description: externalJob.description,
        }),
      })
      if (!ensureRes.ok) {
        const j = await ensureRes.json().catch(() => ({}))
        throw new Error(j.error || 'Failed to register job')
      }
      const { job: internalJob } = await ensureRes.json()

      setResumeText(resume)
      setPrepared({ job: internalJob, candidate: form, resumeText: resume })
    } catch (e) {
      setError(e.message)
    } finally {
      setPreparing(false)
    }
  }

  if (loadingJob) {
    return <div className="min-h-screen pt-32 text-center text-slate-400">Loading job…</div>
  }
  if (error && !externalJob) {
    return (
      <div className="min-h-screen pt-32 px-4 text-center">
        <p className="text-red-400 mb-4">{error}</p>
        <Link href={`/jobs/${id}`} className="text-indigo-400 underline">← Back to job</Link>
      </div>
    )
  }
  if (!externalJob) {
    return <div className="min-h-screen pt-32 text-center text-slate-400">Job not found</div>
  }

  if (prepared && !proctorStreams) {
    return (
      <PermissionGate
        candidateName={prepared.candidate?.name}
        onReady={(streams) => setProctorStreams(streams)}
        onCancel={() => setPrepared(null)}
      />
    )
  }

  if (prepared && proctorStreams) {
    return (
      <InterviewExperience
        job={prepared.job}
        prefilledCandidate={prepared.candidate}
        resumeText={prepared.resumeText}
        cameraStream={proctorStreams.cameraStream}
        screenStream={proctorStreams.screenStream}
      />
    )
  }

  return (
    <div className="min-h-screen pt-32 pb-24 px-4">
      <div className="container mx-auto max-w-3xl">
        <Link href={`/jobs/${id}`} className="text-xs font-black uppercase tracking-widest text-indigo-400 hover:text-indigo-800">
          ← Back to job
        </Link>

        <div className="mt-6 mb-8">
          <span className="inline-block px-4 py-1.5 rounded-full bg-indigo-950/40 border border-indigo-900 text-indigo-400 font-black text-[10px] uppercase tracking-[0.4em] mb-4">
            AI Screening Interview
          </span>
          <h1 className="text-3xl md:text-4xl font-black tracking-tight text-white">
            {externalJob.title}
          </h1>
          <p className="text-indigo-400 font-black uppercase tracking-widest text-xs mt-2">
            {externalJob.company}
          </p>
          <p className="text-slate-400 mt-3">
            Upload your resume and chat with our AI recruiter. Your screening report is sent to the
            hiring team automatically.
          </p>
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-2xl border border-red-800 bg-red-950/40 text-red-400 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleStart} className="bg-slate-900 border border-slate-800 rounded-[2.5rem] p-8 md:p-12 shadow-xl shadow-indigo-500/5">
          <div className="grid gap-5">
            <label className="block">
              <span className="text-xs font-black uppercase tracking-[0.3em] text-slate-300">Your Name</span>
              <input
                type="text"
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Jane Doe"
                className="mt-2 w-full px-5 py-4 rounded-2xl border border-slate-700 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none transition"
              />
            </label>
            <label className="block">
              <span className="text-xs font-black uppercase tracking-[0.3em] text-slate-300">Email (optional)</span>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="jane@example.com"
                className="mt-2 w-full px-5 py-4 rounded-2xl border border-slate-700 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none transition"
              />
            </label>
            <label className="block">
              <span className="text-xs font-black uppercase tracking-[0.3em] text-slate-300">Resume (PDF)</span>
              {savedResume?.resume_text ? (
                <div className="mt-2 p-4 rounded-2xl bg-emerald-950/40 border border-emerald-800 flex items-center gap-3">
                  <svg className="w-6 h-6 text-emerald-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <div className="flex-1">
                    <p className="text-sm font-black text-emerald-200">Using resume on file</p>
                    <p className="text-xs text-emerald-400">
                      Manage in your <a href="/profile" className="underline">profile</a>.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="mt-2">
                  <input
                    type="file"
                    accept="application/pdf,.pdf"
                    onChange={(e) => setFile(e.target.files?.[0] || null)}
                    required
                    className="block w-full text-sm text-slate-300
                      file:mr-4 file:py-3 file:px-6
                      file:rounded-full file:border-0
                      file:text-xs file:font-black file:uppercase file:tracking-widest
                      file:bg-indigo-600 file:text-white
                      hover:file:bg-indigo-700 cursor-pointer"
                  />
                  {file && (
                    <p className="text-xs text-slate-400 mt-2">
                      Selected: {file.name} ({(file.size / 1024).toFixed(0)} KB)
                    </p>
                  )}
                </div>
              )}
            </label>

            <div className="p-5 rounded-2xl bg-amber-950/40 border border-amber-800">
              <p className="text-xs font-black uppercase tracking-[0.3em] text-amber-400 mb-2">
                Step 1 — Test your audio
              </p>
              <p className="text-sm text-amber-300 mb-3">
                This interview is voice-based. Click the button below to confirm you can hear the AI.
                Make sure your tab isn't muted (look for a mute icon in the browser tab) and your system volume is up.
              </p>
              <button
                type="button"
                onClick={testAudio}
                className="text-xs font-black uppercase tracking-widest px-6 py-3 rounded-full bg-amber-600 hover:bg-amber-700 text-white transition"
              >
                {audioTested ? '✓ Audio works — test again' : '🔊 Test Voice'}
              </button>
            </div>

            <button
              type="submit"
              disabled={preparing || !form.name.trim() || (!savedResume && !file)}
              className="btn-style-9 group uppercase tracking-widest text-xs !px-12 !py-5 rounded-full font-black disabled:opacity-60 disabled:cursor-not-allowed self-start"
            >
              <div className="btn-shimmer"></div>
              <span>{preparing ? 'Preparing…' : 'Start Interview'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
