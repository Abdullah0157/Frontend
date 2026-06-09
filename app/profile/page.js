'use client'

import { useEffect, useRef, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { getSupabaseBrowser } from '@/lib/supabase/client'

function ProfileInner() {
  const router = useRouter()
  const params = useSearchParams()
  const onboarding = params.get('onboarding') === '1'
  const postOnboardingNext = params.get('next') || '/jobs'

  const [profile, setProfile] = useState(null)
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const fileInputRef = useRef(null)

  async function load() {
    setLoading(true)
    try {
      const res = await fetch('/api/profile', { cache: 'no-store' })
      if (!res.ok) throw new Error('Failed to load profile')
      const data = await res.json()
      setProfile(data.profile)
      setUser(data.user)
      setName(data.profile?.full_name || '')
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  async function saveName() {
    setSaving(true)
    setError('')
    setSuccess('')
    try {
      const res = await fetch('/api/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ full_name: name }),
      })
      if (!res.ok) throw new Error('Save failed')
      setSuccess('Name updated.')
      await load()
    } catch (e) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  async function onUpload(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    setError('')
    setSuccess('')
    try {
      // 1) Parse PDF via existing /api/upload-resume
      const fd = new FormData()
      fd.append('file', file)
      const parseRes = await fetch('/api/upload-resume', { method: 'POST', body: fd })
      if (!parseRes.ok) {
        const j = await parseRes.json().catch(() => ({}))
        throw new Error(j.error || 'Failed to parse PDF')
      }
      const { text, pages, chars } = await parseRes.json()

      // 2) Save to profile
      const saveRes = await fetch('/api/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          resume_text: text,
          resume_filename: file.name,
          resume_pages: pages,
          resume_chars: chars,
        }),
      })
      if (!saveRes.ok) throw new Error('Failed to save resume')
      setSuccess('Resume uploaded.')
      if (fileInputRef.current) fileInputRef.current.value = ''
      await load()
      // If we're in onboarding mode AND name is set, redirect to next (default /jobs)
      if (onboarding && name.trim()) {
        // Persist name in same flow before navigating
        await fetch('/api/profile', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ full_name: name.trim() }),
        }).catch(() => {})
        router.push(postOnboardingNext)
        router.refresh()
      }
    } catch (e) {
      setError(e.message)
    } finally {
      setUploading(false)
    }
  }

  async function logout() {
    const supabase = getSupabaseBrowser()
    await supabase.auth.signOut()
    router.push('/')
    router.refresh()
  }

  if (loading) {
    return <div className="min-h-screen pt-32 text-center text-slate-400">Loading…</div>
  }

  return (
    <div className="min-h-screen pt-32 pb-24 px-4">
      <div className="container mx-auto max-w-3xl">
        {onboarding && (
          <div className="mb-8 p-6 rounded-[2rem] bg-gradient-to-br from-indigo-950/60 to-blue-950/60 border border-indigo-800 text-center">
            <p className="text-[10px] font-black uppercase tracking-[0.5em] text-indigo-300 mb-2">Welcome 👋</p>
            <h2 className="text-2xl md:text-3xl font-black text-white mb-2">Let's set you up</h2>
            <p className="text-slate-300 text-sm">
              Add your name and upload your resume. We'll use it to match you with jobs and skip the upload step in every interview.
            </p>
          </div>
        )}
        <div className="mb-10 text-center">
          <span className="inline-block px-4 py-1.5 rounded-full bg-indigo-950/40 border border-indigo-900 text-indigo-400 font-black text-[10px] uppercase tracking-[0.4em] mb-4">
            Your Profile
          </span>
          <h1 className="text-3xl md:text-5xl font-black uppercase tracking-tight text-white">
            Hi{profile?.full_name ? `, ${profile.full_name.split(' ')[0]}` : ''}
          </h1>
          <p className="text-slate-400 mt-3 text-sm">{user?.email}</p>
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-2xl border border-red-800 bg-red-950/40 text-red-400 text-sm">{error}</div>
        )}
        {success && (
          <div className="mb-6 p-4 rounded-2xl border border-emerald-800 bg-emerald-950/40 text-emerald-400 text-sm">{success}</div>
        )}

        {/* Name card */}
        <div className="bg-slate-900 border border-slate-800 rounded-[2.5rem] p-8 shadow-xl shadow-indigo-500/5 mb-6">
          <h2 className="text-xs font-black uppercase tracking-[0.3em] text-slate-400 mb-4">Display Name</h2>
          <div className="flex flex-col md:flex-row gap-3">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your full name"
              className="flex-1 px-5 py-4 rounded-2xl border border-slate-700 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none transition"
            />
            <button
              onClick={saveName}
              disabled={saving || !name.trim()}
              className="text-xs font-black uppercase tracking-widest px-6 py-4 rounded-full bg-indigo-600 hover:bg-indigo-700 text-white transition disabled:opacity-60"
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>

        {/* Resume card */}
        <div className="bg-slate-900 border border-slate-800 rounded-[2.5rem] p-8 shadow-xl shadow-indigo-500/5 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xs font-black uppercase tracking-[0.3em] text-slate-400">Resume</h2>
            {profile?.has_resume && (
              <span className="text-[10px] font-black uppercase tracking-[0.3em] text-emerald-400 bg-emerald-950/40 border border-emerald-800 px-3 py-1 rounded-full">
                ✓ On file
              </span>
            )}
          </div>
          {profile?.has_resume ? (
            <div className="space-y-3 mb-5">
              <div className="flex items-center gap-3 p-4 rounded-2xl bg-slate-900 border border-slate-800">
                <svg className="w-10 h-10 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <div className="flex-1 min-w-0">
                  <p className="font-black text-white truncate">{profile.resume_filename || 'resume.pdf'}</p>
                  <p className="text-xs text-slate-400">
                    {profile.resume_pages} pages · {profile.resume_chars?.toLocaleString()} chars · uploaded{' '}
                    {profile.resume_uploaded_at ? new Date(profile.resume_uploaded_at).toLocaleDateString() : '—'}
                  </p>
                </div>
              </div>
              <p className="text-xs text-slate-400">
                This resume is used automatically when you take an AI interview, so you don't need to upload it again.
              </p>
            </div>
          ) : (
            <p className="text-slate-400 text-sm mb-5">
              Upload your resume once. We'll use it to tailor every AI interview to your background.
            </p>
          )}

          <label className="block">
            <input
              ref={fileInputRef}
              type="file"
              accept="application/pdf,.pdf"
              onChange={onUpload}
              disabled={uploading}
              className="block w-full text-sm text-slate-300
                file:mr-4 file:py-3 file:px-6
                file:rounded-full file:border-0
                file:text-xs file:font-black file:uppercase file:tracking-widest
                file:bg-indigo-600 file:text-white
                hover:file:bg-indigo-700 cursor-pointer"
            />
          </label>
          {uploading && <p className="text-xs text-slate-400 mt-2">Parsing PDF…</p>}
        </div>

        {/* Account actions */}
        <div className="flex flex-col md:flex-row gap-3 items-center justify-between bg-slate-900 border border-slate-800 rounded-[2rem] p-6">
          <Link href="/jobs" className="text-xs font-black uppercase tracking-widest text-indigo-400 hover:text-indigo-800">
            → Browse jobs
          </Link>
          <button
            onClick={logout}
            className="text-xs font-black uppercase tracking-widest px-5 py-3 rounded-full bg-slate-800 hover:bg-slate-200 text-slate-200 transition"
          >
            Log out
          </button>
        </div>
      </div>
    </div>
  )
}

export default function ProfilePage() {
  return (
    <Suspense>
      <ProfileInner />
    </Suspense>
  )
}
