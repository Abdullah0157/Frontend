'use client'

import { useEffect, useRef, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { getSupabaseBrowser } from '@/lib/supabase/client'

// ─── Helpers ─────────────────────────────────────────────────────────────────
function uid() { return Math.random().toString(36).slice(2) }

// ─── Section editors ─────────────────────────────────────────────────────────
function SkillsEditor({ skills = [], onChange }) {
  const [input, setInput] = useState('')
  function add() {
    const v = input.trim()
    if (!v || skills.includes(v)) return
    onChange([...skills, v])
    setInput('')
  }
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {skills.map((s) => (
          <span key={s} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-700 text-xs font-bold">
            {s}
            <button onClick={() => onChange(skills.filter((x) => x !== s))} className="text-indigo-500 hover:text-red-600 transition leading-none">✕</button>
          </span>
        ))}
        {skills.length === 0 && <p className="text-slate-400 text-xs italic">No skills yet</p>}
      </div>
      <div className="flex gap-2">
        <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && add()}
          placeholder="Add a skill and press Enter"
          className="flex-1 px-4 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-900 text-sm focus:border-indigo-500 outline-none transition" />
        <button onClick={add} className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-black uppercase tracking-widest transition">+ Add</button>
      </div>
    </div>
  )
}

function ExperienceCard({ item, onSave, onDelete }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(item)
  const [bulletInput, setBulletInput] = useState('')

  function addBullet() {
    const v = bulletInput.trim()
    if (!v) return
    setDraft(d => ({ ...d, bullets: [...(d.bullets || []), v] }))
    setBulletInput('')
  }

  if (!editing) return (
    <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5">
      <div className="flex items-start justify-between gap-3 mb-2">
        <div>
          <p className="font-black text-slate-900">{item.title}</p>
          <p className="text-indigo-600 text-sm">{item.company}{item.location ? ` · ${item.location}` : ''}</p>
          {item.dates && <p className="text-slate-400 text-xs mt-0.5">{item.dates}</p>}
        </div>
        <div className="flex gap-2 flex-shrink-0">
          <button onClick={() => setEditing(true)} className="text-xs font-black uppercase tracking-widest px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 transition">Edit</button>
          <button onClick={onDelete} className="text-xs font-black uppercase tracking-widest px-3 py-1.5 rounded-lg bg-red-50 hover:bg-red-100 text-red-600 transition">✕</button>
        </div>
      </div>
      {(item.bullets || []).length > 0 && (
        <ul className="mt-3 space-y-1">
          {item.bullets.map((b, i) => <li key={i} className="text-slate-700 text-sm flex gap-2"><span className="text-indigo-500 flex-shrink-0">•</span>{b}</li>)}
        </ul>
      )}
    </div>
  )

  return (
    <div className="bg-indigo-50 border border-indigo-200 rounded-2xl p-5 space-y-3">
      <div className="grid grid-cols-2 gap-3">
        {[['title','Job Title'],['company','Company'],['location','Location (optional)'],['dates','Dates (e.g. Jan 2020 – Present)']].map(([k, ph]) => (
          <input key={k} value={draft[k] || ''} onChange={e => setDraft(d => ({...d, [k]: e.target.value}))} placeholder={ph}
            className="px-3 py-2 rounded-xl border border-slate-300 bg-white text-slate-900 text-sm focus:border-indigo-500 outline-none transition" />
        ))}
      </div>
      <div>
        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Achievements / Bullets</p>
        <ul className="space-y-1 mb-2">
          {(draft.bullets || []).map((b, i) => (
            <li key={i} className="flex items-center gap-2 text-sm text-slate-700">
              <span className="text-indigo-500">•</span>
              <span className="flex-1">{b}</span>
              <button onClick={() => setDraft(d => ({...d, bullets: d.bullets.filter((_, j) => j !== i)}))} className="text-slate-600 hover:text-red-600 text-xs">✕</button>
            </li>
          ))}
        </ul>
        <div className="flex gap-2">
          <input value={bulletInput} onChange={e => setBulletInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && addBullet()} placeholder="Add achievement and press Enter"
            className="flex-1 px-3 py-2 rounded-xl border border-slate-300 bg-white text-slate-900 text-sm focus:border-indigo-500 outline-none" />
          <button onClick={addBullet} className="px-3 py-2 rounded-xl bg-indigo-600 text-white text-xs font-black">+ Add</button>
        </div>
      </div>
      <div className="flex gap-2 pt-1">
        <button onClick={() => { onSave(draft); setEditing(false) }} className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-black uppercase tracking-widest transition">Save</button>
        <button onClick={() => { setDraft(item); setEditing(false) }} className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-black uppercase tracking-widest transition">Cancel</button>
      </div>
    </div>
  )
}

function EducationCard({ item, onSave, onDelete }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(item)
  if (!editing) return (
    <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 flex items-start justify-between gap-3">
      <div>
        <p className="font-black text-slate-900">{item.degree}</p>
        <p className="text-indigo-600 text-sm">{item.school}</p>
        {item.year && <p className="text-slate-400 text-xs mt-0.5">{item.year}</p>}
      </div>
      <div className="flex gap-2 flex-shrink-0">
        <button onClick={() => setEditing(true)} className="text-xs font-black uppercase tracking-widest px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 transition">Edit</button>
        <button onClick={onDelete} className="text-xs px-3 py-1.5 rounded-lg bg-red-50 hover:bg-red-100 text-red-600 transition">✕</button>
      </div>
    </div>
  )
  return (
    <div className="bg-indigo-50 border border-indigo-200 rounded-2xl p-5 space-y-3">
      <div className="grid grid-cols-3 gap-3">
        {[['degree','Degree'],['school','School / University'],['year','Year']].map(([k, ph]) => (
          <input key={k} value={draft[k] || ''} onChange={e => setDraft(d => ({...d, [k]: e.target.value}))} placeholder={ph}
            className="px-3 py-2 rounded-xl border border-slate-300 bg-white text-slate-900 text-sm focus:border-indigo-500 outline-none transition" />
        ))}
      </div>
      <div className="flex gap-2">
        <button onClick={() => { onSave(draft); setEditing(false) }} className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-black uppercase tracking-widest">Save</button>
        <button onClick={() => { setDraft(item); setEditing(false) }} className="px-4 py-2 rounded-xl bg-slate-100 text-slate-600 text-xs font-black uppercase tracking-widest">Cancel</button>
      </div>
    </div>
  )
}

function ProjectCard({ item, onSave, onDelete }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(item)
  if (!editing) return (
    <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 flex items-start justify-between gap-3">
      <div className="flex-1">
        <p className="font-black text-slate-900">{item.name}</p>
        {item.tech && <p className="text-indigo-600 text-xs mt-0.5">{item.tech}</p>}
        {item.description && <p className="text-slate-500 text-sm mt-1 leading-relaxed">{item.description}</p>}
      </div>
      <div className="flex gap-2 flex-shrink-0">
        <button onClick={() => setEditing(true)} className="text-xs font-black uppercase tracking-widest px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 transition">Edit</button>
        <button onClick={onDelete} className="text-xs px-3 py-1.5 rounded-lg bg-red-50 hover:bg-red-100 text-red-600 transition">✕</button>
      </div>
    </div>
  )
  return (
    <div className="bg-indigo-50 border border-indigo-200 rounded-2xl p-5 space-y-3">
      <input value={draft.name || ''} onChange={e => setDraft(d => ({...d, name: e.target.value}))} placeholder="Project name"
        className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-slate-900 text-sm focus:border-indigo-500 outline-none" />
      <input value={draft.tech || ''} onChange={e => setDraft(d => ({...d, tech: e.target.value}))} placeholder="Tech stack (React, Node.js, PostgreSQL)"
        className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-slate-900 text-sm focus:border-indigo-500 outline-none" />
      <textarea value={draft.description || ''} onChange={e => setDraft(d => ({...d, description: e.target.value}))} placeholder="What it does and your role" rows={3}
        className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-slate-900 text-sm focus:border-indigo-500 outline-none resize-none" />
      <div className="flex gap-2">
        <button onClick={() => { onSave(draft); setEditing(false) }} className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-black uppercase tracking-widest">Save</button>
        <button onClick={() => { setDraft(item); setEditing(false) }} className="px-4 py-2 rounded-xl bg-slate-100 text-slate-600 text-xs font-black uppercase tracking-widest">Cancel</button>
      </div>
    </div>
  )
}

// ─── Main Profile Component ───────────────────────────────────────────────────
function ProfileInner() {
  const router = useRouter()
  const params = useSearchParams()
  const onboarding = params.get('onboarding') === '1'
  const postOnboardingNext = params.get('next') || '/dashboard'
  const tabParam = params.get('tab')

  const [profile, setProfile] = useState(null)
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState(tabParam || 'personal')
  const [saving, setSaving] = useState('')
  const [uploading, setUploading] = useState(false)
  const [parsing, setParsing] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  // Personal Info
  const [name, setName] = useState('')
  // Links
  const [linkedin, setLinkedin] = useState('')
  const [github, setGithub] = useState('')
  // Certificates
  const [certs, setCerts] = useState([])
  const [newCert, setNewCert] = useState({ name: '', issuer: '', year: '', url: '' })
  // Resume sections
  const [sections, setSections] = useState(null) // null = not loaded yet

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
      setLinkedin(data.profile?.linkedin_url || '')
      setGithub(data.profile?.github_url || '')
      setCerts(data.profile?.certificates || [])
      setSections(data.profile?.resume_sections || null)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  async function save(payload, successMsg) {
    setSaving(successMsg)
    setError('')
    setSuccess('')
    try {
      const res = await fetch('/api/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) throw new Error('Save failed')
      setSuccess(successMsg)
      await load()
      if (onboarding && payload.resume_text) {
        router.push(postOnboardingNext)
        router.refresh()
      }
    } catch (e) {
      setError(e.message)
    } finally {
      setSaving('')
    }
  }

  async function onUpload(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    setError('')
    setSuccess('')
    try {
      const fd = new FormData()
      fd.append('file', file)
      const parseRes = await fetch('/api/upload-resume', { method: 'POST', body: fd })
      if (!parseRes.ok) {
        const j = await parseRes.json().catch(() => ({}))
        throw new Error(j.error || 'Failed to parse PDF')
      }
      const { text, pages, chars } = await parseRes.json()
      await save({ resume_text: text, resume_filename: file.name, resume_pages: pages, resume_chars: chars }, 'Resume uploaded.')
      if (fileInputRef.current) fileInputRef.current.value = ''
      // Auto-parse sections in background
      parseResumeSections()
    } catch (e) {
      setError(e.message)
    } finally {
      setUploading(false)
    }
  }

  async function parseResumeSections() {
    setParsing(true)
    setError('')
    try {
      const res = await fetch('/api/parse-resume', { method: 'POST' })
      if (!res.ok) throw new Error('Failed to parse resume sections')
      const data = await res.json()
      setSections(data.sections)
      setSuccess('Resume sections extracted! Check the "My Resume" tab.')
    } catch (e) {
      setError(e.message)
    } finally {
      setParsing(false)
    }
  }

  async function saveSections(updated) {
    setSections(updated)
    await save({ resume_sections: updated }, 'Resume saved.')
  }

  function updateExperience(id, data) {
    saveSections({ ...sections, experience: sections.experience.map(e => e.id === id ? { ...data, id } : e) })
  }
  function deleteExperience(id) {
    saveSections({ ...sections, experience: sections.experience.filter(e => e.id !== id) })
  }
  function addExperience() {
    saveSections({ ...sections, experience: [...(sections?.experience || []), { id: uid(), title: '', company: '', location: '', dates: '', bullets: [] }] })
  }

  function updateEducation(id, data) {
    saveSections({ ...sections, education: sections.education.map(e => e.id === id ? { ...data, id } : e) })
  }
  function deleteEducation(id) {
    saveSections({ ...sections, education: sections.education.filter(e => e.id !== id) })
  }
  function addEducation() {
    saveSections({ ...sections, education: [...(sections?.education || []), { id: uid(), degree: '', school: '', year: '' }] })
  }

  function updateProject(id, data) {
    saveSections({ ...sections, projects: sections.projects.map(p => p.id === id ? { ...data, id } : p) })
  }
  function deleteProject(id) {
    saveSections({ ...sections, projects: sections.projects.filter(p => p.id !== id) })
  }
  function addProject() {
    saveSections({ ...sections, projects: [...(sections?.projects || []), { id: uid(), name: '', tech: '', description: '' }] })
  }

  function addCert() {
    if (!newCert.name.trim()) return
    const updated = [...certs, { ...newCert, name: newCert.name.trim() }]
    setCerts(updated)
    setNewCert({ name: '', issuer: '', year: '', url: '' })
    save({ certificates: updated }, 'Certificate added.')
  }
  function deleteCert(idx) {
    const updated = certs.filter((_, i) => i !== idx)
    setCerts(updated)
    save({ certificates: updated }, 'Certificate removed.')
  }

  async function logout() {
    const supabase = getSupabaseBrowser()
    await supabase.auth.signOut()
    router.push('/')
    router.refresh()
  }

  const tabs = [
    { id: 'personal', label: 'Personal Info' },
    { id: 'resume', label: 'Resume & Links' },
    { id: 'my-resume', label: 'My Resume' },
    { id: 'certs', label: 'Certificates' },
  ]

  if (loading) return <div className="min-h-screen pt-32 text-center text-slate-500">Loading…</div>

  return (
    <div className="min-h-screen pt-32 pb-24 px-4">
      <div className="container mx-auto max-w-3xl">
        {onboarding && (
          <div className="mb-8 p-6 rounded-[2rem] bg-gradient-to-br from-indigo-50 to-blue-50 border border-indigo-200 text-center">
            <p className="text-[10px] font-black uppercase tracking-[0.5em] text-indigo-300 mb-2">Welcome</p>
            <h2 className="text-2xl md:text-3xl font-black text-slate-900 mb-2">Let's set you up</h2>
            {profile?.has_resume ? (
              <div className="mt-3">
                <p className="text-emerald-600 text-sm mb-4">✓ Resume uploaded — you're all set!</p>
                <button
                  onClick={() => { router.push(postOnboardingNext); router.refresh() }}
                  className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white font-black uppercase tracking-widest text-xs px-8 py-3 rounded-full transition shadow-lg shadow-indigo-500/20"
                >
                  Continue to Dashboard →
                </button>
              </div>
            ) : (
              <p className="text-slate-700 text-sm">Upload your resume to get started. Name and links can be added later.</p>
            )}
          </div>
        )}

        <div className="mb-10 text-center">
          <span className="inline-block px-4 py-1.5 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-600 font-black text-[10px] uppercase tracking-[0.4em] mb-4">Your Profile</span>
          <h1 className="text-3xl md:text-5xl font-black uppercase tracking-tight text-slate-900">
            Hi{profile?.full_name ? `, ${profile.full_name.split(' ')[0]}` : ''}
          </h1>
          <p className="text-slate-500 mt-3 text-sm">{user?.email}</p>
        </div>

        {error && <div className="mb-6 p-4 rounded-2xl border border-red-200 bg-red-50 text-red-600 text-sm">{error}</div>}
        {success && <div className="mb-6 p-4 rounded-2xl border border-emerald-200 bg-emerald-50 text-emerald-600 text-sm">{success}</div>}

        {/* Tabs */}
        <div className="flex flex-wrap gap-2 mb-8">
          {tabs.map(t => (
            <button key={t.id} onClick={() => setActiveTab(t.id)}
              className={`px-5 py-2.5 rounded-full text-xs font-black uppercase tracking-widest transition ${activeTab === t.id ? 'bg-indigo-600 text-white' : 'bg-white border border-slate-200 text-slate-400 hover:text-slate-900'}`}>
              {t.label}
            </button>
          ))}
        </div>

        {/* ── Tab: Personal Info ──────────────────────────────────────── */}
        {activeTab === 'personal' && (
          <div className="bg-white border border-slate-200 rounded-[2.5rem] p-8 shadow-xl shadow-indigo-500/5 space-y-6">
            <div>
              <h2 className="text-xs font-black uppercase tracking-[0.3em] text-slate-500 mb-4">Display Name</h2>
              <div className="flex flex-col md:flex-row gap-3">
                <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Your full name"
                  className="flex-1 px-5 py-4 rounded-2xl border border-slate-300 bg-white text-slate-900 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none transition" />
                <button onClick={() => save({ full_name: name }, 'Name saved.')} disabled={!!saving || !name.trim()}
                  className="text-xs font-black uppercase tracking-widest px-6 py-4 rounded-full bg-indigo-600 hover:bg-indigo-700 text-white transition disabled:opacity-60">
                  {saving === 'Name saved.' ? 'Saving…' : 'Save'}
                </button>
              </div>
            </div>
            <div>
              <h2 className="text-xs font-black uppercase tracking-[0.3em] text-slate-500 mb-2">Email</h2>
              <p className="text-slate-700 px-5 py-4 rounded-2xl border border-slate-200 bg-slate-50">{user?.email}</p>
            </div>
          </div>
        )}

        {/* ── Tab: Resume & Links ─────────────────────────────────────── */}
        {activeTab === 'resume' && (
          <div className="space-y-6">
            <div className="bg-white border border-slate-200 rounded-[2.5rem] p-8 shadow-xl shadow-indigo-500/5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xs font-black uppercase tracking-[0.3em] text-slate-500">Resume (PDF)</h2>
                {profile?.has_resume && (
                  <span className="text-[10px] font-black uppercase tracking-widest text-emerald-600 bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-full">✓ On file</span>
                )}
              </div>
              {profile?.has_resume && (
                <div className="flex items-center gap-3 p-4 rounded-2xl bg-slate-50 border border-slate-200 mb-4">
                  <svg className="w-10 h-10 text-indigo-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <div className="flex-1 min-w-0">
                    <p className="font-black text-slate-900 truncate">{profile.resume_filename || 'resume.pdf'}</p>
                    <p className="text-xs text-slate-500">{profile.resume_pages} pages · {profile.resume_chars?.toLocaleString()} chars</p>
                  </div>
                  {!sections && !parsing && (
                    <button onClick={parseResumeSections} className="text-xs font-black uppercase tracking-widest px-4 py-2 rounded-full bg-indigo-600 hover:bg-indigo-500 text-white transition flex-shrink-0">
                      Extract Sections →
                    </button>
                  )}
                  {parsing && <p className="text-xs text-indigo-600 animate-pulse flex-shrink-0">Extracting…</p>}
                </div>
              )}
              <label className="block">
                <span className="text-xs text-slate-500 mb-2 block">{profile?.has_resume ? 'Replace resume:' : 'Upload your resume (PDF):'}</span>
                <input ref={fileInputRef} type="file" accept="application/pdf,.pdf" onChange={onUpload} disabled={uploading}
                  className="block w-full text-sm text-slate-700 file:mr-4 file:py-3 file:px-6 file:rounded-full file:border-0 file:text-xs file:font-black file:uppercase file:tracking-widest file:bg-indigo-600 file:text-white hover:file:bg-indigo-700 cursor-pointer" />
              </label>
              {uploading && <p className="text-xs text-slate-500 mt-2 animate-pulse">Parsing PDF…</p>}
            </div>

            <div className="bg-white border border-slate-200 rounded-[2.5rem] p-8 shadow-xl shadow-indigo-500/5">
              <h2 className="text-xs font-black uppercase tracking-[0.3em] text-slate-500 mb-4">LinkedIn Profile</h2>
              <div className="flex flex-col md:flex-row gap-3">
                <input type="url" value={linkedin} onChange={e => setLinkedin(e.target.value)}
                  placeholder="https://linkedin.com/in/yourname"
                  className="flex-1 px-5 py-4 rounded-2xl border border-slate-300 bg-white text-slate-900 focus:border-indigo-500 outline-none transition" />
                <button onClick={() => save({ linkedin_url: linkedin }, 'LinkedIn saved.')} disabled={!!saving}
                  className="text-xs font-black uppercase tracking-widest px-6 py-4 rounded-full bg-indigo-600 hover:bg-indigo-700 text-white transition disabled:opacity-60">
                  {saving === 'LinkedIn saved.' ? 'Saving…' : 'Save'}
                </button>
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-[2.5rem] p-8 shadow-xl shadow-indigo-500/5">
              <h2 className="text-xs font-black uppercase tracking-[0.3em] text-slate-500 mb-4">GitHub Profile</h2>
              <div className="flex flex-col md:flex-row gap-3">
                <input type="url" value={github} onChange={e => setGithub(e.target.value)}
                  placeholder="https://github.com/yourusername"
                  className="flex-1 px-5 py-4 rounded-2xl border border-slate-300 bg-white text-slate-900 focus:border-indigo-500 outline-none transition" />
                <button onClick={() => save({ github_url: github }, 'GitHub saved.')} disabled={!!saving}
                  className="text-xs font-black uppercase tracking-widest px-6 py-4 rounded-full bg-indigo-600 hover:bg-indigo-700 text-white transition disabled:opacity-60">
                  {saving === 'GitHub saved.' ? 'Saving…' : 'Save'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Tab: My Resume (sections) ───────────────────────────────── */}
        {activeTab === 'my-resume' && (
          <div className="space-y-8">
            {!profile?.has_resume ? (
              <div className="bg-white border border-slate-200 rounded-[2.5rem] p-12 text-center shadow-xl shadow-indigo-500/5">
                <p className="text-slate-500 text-sm mb-4">Upload your resume first to extract sections.</p>
                <button onClick={() => setActiveTab('resume')} className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white font-black uppercase tracking-widest text-xs px-8 py-3 rounded-full transition">
                  Go to Resume & Links →
                </button>
              </div>
            ) : !sections && !parsing ? (
              <div className="bg-white border border-slate-200 rounded-[2.5rem] p-12 text-center shadow-xl shadow-indigo-500/5">
                <p className="text-slate-500 text-sm mb-2">Your resume hasn't been parsed into sections yet.</p>
                <p className="text-slate-400 text-xs mb-6">Iris (AI) will read your resume and extract experience, education, projects, and skills.</p>
                <button onClick={parseResumeSections} disabled={parsing} className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white font-black uppercase tracking-widest text-xs px-8 py-3 rounded-full transition disabled:opacity-60">
                  {parsing ? 'Extracting…' : 'Extract Resume Sections →'}
                </button>
              </div>
            ) : parsing ? (
              <div className="bg-white border border-slate-200 rounded-[2.5rem] p-12 text-center shadow-xl shadow-indigo-500/5">
                <div className="w-10 h-10 rounded-full border-4 border-indigo-500 border-t-transparent animate-spin mx-auto mb-4" />
                <p className="text-indigo-600 font-black uppercase tracking-widest text-xs">Extracting from resume…</p>
              </div>
            ) : (
              <>
                {/* Summary */}
                <div className="bg-white border border-slate-200 rounded-[2.5rem] p-8 shadow-xl shadow-indigo-500/5">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xs font-black uppercase tracking-[0.3em] text-slate-500">Summary</h2>
                  </div>
                  <textarea value={sections?.summary || ''} onChange={e => setSections(s => ({...s, summary: e.target.value}))}
                    rows={4} placeholder="Your professional summary…"
                    className="w-full px-5 py-4 rounded-2xl border border-slate-300 bg-white text-slate-900 text-sm focus:border-indigo-500 outline-none transition resize-none" />
                  <button onClick={() => save({ resume_sections: sections }, 'Summary saved.')} disabled={!!saving}
                    className="mt-3 text-xs font-black uppercase tracking-widest px-6 py-3 rounded-full bg-indigo-600 hover:bg-indigo-700 text-white transition disabled:opacity-60">
                    {saving === 'Summary saved.' ? 'Saving…' : 'Save Summary'}
                  </button>
                </div>

                {/* Skills */}
                <div className="bg-white border border-slate-200 rounded-[2.5rem] p-8 shadow-xl shadow-indigo-500/5">
                  <h2 className="text-xs font-black uppercase tracking-[0.3em] text-slate-500 mb-5">Skills</h2>
                  <SkillsEditor
                    skills={sections?.skills || []}
                    onChange={(updated) => saveSections({ ...sections, skills: updated })}
                  />
                </div>

                {/* Experience */}
                <div className="bg-white border border-slate-200 rounded-[2.5rem] p-8 shadow-xl shadow-indigo-500/5">
                  <div className="flex items-center justify-between mb-5">
                    <h2 className="text-xs font-black uppercase tracking-[0.3em] text-slate-500">Experience</h2>
                    <button onClick={addExperience} className="text-xs font-black uppercase tracking-widest px-4 py-2 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 border border-slate-200 transition">
                      + Add Role
                    </button>
                  </div>
                  <div className="space-y-3">
                    {(sections?.experience || []).map(exp => (
                      <ExperienceCard key={exp.id} item={exp}
                        onSave={(d) => updateExperience(exp.id, d)}
                        onDelete={() => deleteExperience(exp.id)} />
                    ))}
                    {(sections?.experience || []).length === 0 && (
                      <p className="text-slate-400 text-sm text-center py-4">No experience added yet.</p>
                    )}
                  </div>
                </div>

                {/* Education */}
                <div className="bg-white border border-slate-200 rounded-[2.5rem] p-8 shadow-xl shadow-indigo-500/5">
                  <div className="flex items-center justify-between mb-5">
                    <h2 className="text-xs font-black uppercase tracking-[0.3em] text-slate-500">Education</h2>
                    <button onClick={addEducation} className="text-xs font-black uppercase tracking-widest px-4 py-2 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 border border-slate-200 transition">
                      + Add Education
                    </button>
                  </div>
                  <div className="space-y-3">
                    {(sections?.education || []).map(edu => (
                      <EducationCard key={edu.id} item={edu}
                        onSave={(d) => updateEducation(edu.id, d)}
                        onDelete={() => deleteEducation(edu.id)} />
                    ))}
                    {(sections?.education || []).length === 0 && (
                      <p className="text-slate-400 text-sm text-center py-4">No education added yet.</p>
                    )}
                  </div>
                </div>

                {/* Projects */}
                <div className="bg-white border border-slate-200 rounded-[2.5rem] p-8 shadow-xl shadow-indigo-500/5">
                  <div className="flex items-center justify-between mb-5">
                    <h2 className="text-xs font-black uppercase tracking-[0.3em] text-slate-500">Projects</h2>
                    <button onClick={addProject} className="text-xs font-black uppercase tracking-widest px-4 py-2 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 border border-slate-200 transition">
                      + Add Project
                    </button>
                  </div>
                  <div className="space-y-3">
                    {(sections?.projects || []).map(proj => (
                      <ProjectCard key={proj.id} item={proj}
                        onSave={(d) => updateProject(proj.id, d)}
                        onDelete={() => deleteProject(proj.id)} />
                    ))}
                    {(sections?.projects || []).length === 0 && (
                      <p className="text-slate-400 text-sm text-center py-4">No projects added yet.</p>
                    )}
                  </div>
                </div>

                {/* Re-parse button */}
                <div className="text-center">
                  <button onClick={parseResumeSections} disabled={parsing}
                    className="text-xs font-black uppercase tracking-widest text-slate-400 hover:text-slate-700 transition disabled:opacity-60">
                    ↺ Re-extract from resume PDF
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {/* ── Tab: Certificates ───────────────────────────────────────── */}
        {activeTab === 'certs' && (
          <div className="space-y-6">
            {certs.length > 0 && (
              <div className="space-y-3">
                {certs.map((c, i) => (
                  <div key={i} className="bg-white border border-slate-200 rounded-[2rem] p-6 flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <p className="font-black text-slate-900">{c.name}</p>
                      {c.issuer && <p className="text-xs text-slate-500 mt-0.5">{c.issuer}{c.year ? ` · ${c.year}` : ''}</p>}
                      {c.url && (
                        <a href={c.url} target="_blank" rel="noopener noreferrer"
                          className="text-xs text-indigo-600 hover:text-indigo-800 mt-1 inline-flex items-center gap-1">
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                          View certificate
                        </a>
                      )}
                    </div>
                    <button onClick={() => deleteCert(i)} className="text-slate-600 hover:text-red-600 transition flex-shrink-0">
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className="bg-white border border-slate-200 rounded-[2.5rem] p-8 shadow-xl shadow-indigo-500/5">
              <h2 className="text-xs font-black uppercase tracking-[0.3em] text-slate-500 mb-6">Add Certificate</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                {[['Name *','text',newCert.name,'name','AWS Solutions Architect'],['Issuer','text',newCert.issuer,'issuer','Amazon Web Services'],['Year','text',newCert.year,'year','2024'],['URL (optional)','url',newCert.url,'url','https://credential.link']].map(([label, type, val, key, ph]) => (
                  <div key={key}>
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1 block">{label}</label>
                    <input type={type} value={val} onChange={e => setNewCert(p => ({...p, [key]: e.target.value}))} placeholder={ph}
                      className="w-full px-4 py-3 rounded-2xl border border-slate-300 bg-white text-slate-900 focus:border-indigo-500 outline-none transition text-sm" />
                  </div>
                ))}
              </div>
              <button onClick={addCert} disabled={!newCert.name.trim() || !!saving}
                className="text-xs font-black uppercase tracking-widest px-8 py-3 rounded-full bg-indigo-600 hover:bg-indigo-700 text-white transition disabled:opacity-60">
                + Add Certificate
              </button>
            </div>
          </div>
        )}

        {/* Bottom nav */}
        <div className="flex flex-col md:flex-row gap-3 items-center justify-between mt-8">
          <Link href="/dashboard" className="text-xs font-black uppercase tracking-widest text-indigo-600 hover:text-indigo-800">
            ← Dashboard
          </Link>
          <button onClick={logout}
            className="text-xs font-black uppercase tracking-widest px-5 py-3 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-800 transition">
            Log out
          </button>
        </div>
      </div>
    </div>
  )
}

export default function ProfilePage() {
  return <Suspense><ProfileInner /></Suspense>
}
