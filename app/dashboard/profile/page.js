'use client'

import { useEffect, useRef, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { getSupabaseBrowser } from '@/lib/supabase/client'
import ResumeAnalyzer from '@/components/ResumeAnalyzer'

// ── tiny helpers ──────────────────────────────────────────────────────────────
function uid() { return Math.random().toString(36).slice(2) }
function Divider() { return <div className="border-t border-slate-100" /> }

// ── Shared form controls for the preference tabs ──────────────────────────────
const FIELD_CLS = 'w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition'
function Label({ children }) {
  return <label className="block text-xs font-black uppercase tracking-[0.2em] text-slate-500 mb-2">{children}</label>
}
function Field({ label, hint, children }) {
  return (
    <div>
      <Label>{label}</Label>
      {children}
      {hint && <p className="text-xs text-slate-400 mt-1.5">{hint}</p>}
    </div>
  )
}
function TextField({ label, hint, value, onChange, placeholder, type = 'text' }) {
  return (
    <Field label={label} hint={hint}>
      <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} className={FIELD_CLS} />
    </Field>
  )
}
function SelectField({ label, hint, value, onChange, options }) {
  return (
    <Field label={label} hint={hint}>
      <select value={value} onChange={e => onChange(e.target.value)} className={FIELD_CLS}>
        <option value="">Select…</option>
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    </Field>
  )
}
function Toggle({ label, hint, checked, onChange }) {
  return (
    <label className="flex items-start gap-3 cursor-pointer group">
      <input type="checkbox" checked={!!checked} onChange={e => onChange(e.target.checked)}
        className="mt-0.5 h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer" />
      <span className="min-w-0">
        <span className="block text-sm font-medium text-slate-800 group-hover:text-slate-900">{label}</span>
        {hint && <span className="block text-xs text-slate-400 mt-0.5">{hint}</span>}
      </span>
    </label>
  )
}
function SaveBar({ saving, onSave }) {
  return (
    <div className="pt-2">
      <button onClick={onSave} disabled={saving}
        className="px-5 py-2.5 text-sm font-semibold bg-slate-900 text-white rounded-xl hover:bg-slate-800 disabled:opacity-50 transition">
        {saving ? 'Saving…' : 'Save'}
      </button>
    </div>
  )
}

// ── Resume section sub-components ────────────────────────────────────────────
function SkillsEditor({ skills = [], onChange }) {
  const [input, setInput] = useState('')
  function add() {
    const v = input.trim()
    if (!v || skills.includes(v)) return
    onChange([...skills, v])
    setInput('')
  }
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {skills.map((s) => (
          <span key={s} className="inline-flex items-center gap-1.5 text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-100 px-3 py-1.5 rounded-full">
            {s}
            <button onClick={() => onChange(skills.filter((x) => x !== s))} className="text-indigo-400 hover:text-red-500 transition">✕</button>
          </span>
        ))}
        {!skills.length && <p className="text-sm text-slate-400">No skills yet</p>}
      </div>
      <div className="flex gap-2">
        <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && add()}
          placeholder="Type a skill and press Enter"
          className="flex-1 rounded-xl border border-slate-300 px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition" />
        <button onClick={add} className="text-sm font-semibold px-4 py-2.5 border border-slate-200 rounded-xl text-slate-700 hover:bg-slate-50 transition">Add</button>
      </div>
    </div>
  )
}

// Split an existing "May 2022 – Present" style string into {start, end}.
function splitDates(str) {
  if (!str) return { start: '', end: '' }
  const parts = String(str).split(/\s*(?:–|—|-|to|until|through)\s*/i).map(s => s.trim()).filter(Boolean)
  if (parts.length >= 2) return { start: parts[0], end: parts.slice(1).join(' ') }
  return { start: String(str).trim(), end: '' }
}
// Recompose a display string from start/end.
function joinDates(start, end) {
  const s = (start || '').trim(); const e = (end || '').trim()
  if (s && e) return `${s} – ${e}`
  return s || e || ''
}

// ─── Month + Year picker (calendar-style dropdowns) ──────────────────────────
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']
function parseMY(str) {
  if (!str) return { month: '', year: '' }
  const s = String(str).trim()
  const m = s.match(/([A-Za-z]{3,})\.?\s*,?\s*(\d{4})/)   // "May 2026" / "Sept, 2026"
  if (m) {
    const mo = MONTHS.find(x => x.toLowerCase().startsWith(m[1].slice(0, 3).toLowerCase())) || ''
    return { month: mo, year: m[2] }
  }
  const y = s.match(/(\d{4})/)
  return { month: '', year: y ? y[1] : '' }
}
function fmtMY(month, year) {
  if (month && year) return `${month} ${year}`
  return year || month || ''
}
function MonthYearPicker({ value, onChange, disabled }) {
  const { month, year } = parseMY(value)
  const currentYear = new Date().getFullYear()
  const years = []
  for (let y = currentYear + 1; y >= 1975; y--) years.push(String(y))
  const cls = 'rounded-lg border border-slate-300 px-2.5 py-2 text-sm text-slate-900 bg-white focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 disabled:bg-slate-100 disabled:text-slate-400 transition cursor-pointer'
  return (
    <div className="grid grid-cols-2 gap-1.5">
      <select disabled={disabled} value={month} onChange={e => onChange(fmtMY(e.target.value, year))} className={cls}>
        <option value="">Month</option>
        {MONTHS.map(m => <option key={m} value={m}>{m}</option>)}
      </select>
      <select disabled={disabled} value={year} onChange={e => onChange(fmtMY(month, e.target.value))} className={cls}>
        <option value="">Year</option>
        {years.map(y => <option key={y} value={y}>{y}</option>)}
      </select>
    </div>
  )
}

// Year-only dropdowns (Start year / End year) — matches the Mercor layout.
const YEARS = (() => { const top = new Date().getFullYear() + 1; const a = []; for (let y = top; y >= 1975; y--) a.push(String(y)); return a })()
function YearSelect({ value, onChange, disabled, placeholder = 'Select year' }) {
  const cls = 'w-full rounded-lg border border-slate-300 px-2.5 py-2 text-sm text-slate-900 bg-white focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 disabled:bg-slate-100 disabled:text-slate-400 transition cursor-pointer'
  return (
    <select disabled={disabled} value={value || ''} onChange={e => onChange(e.target.value)} className={cls}>
      <option value="">{placeholder}</option>
      {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
    </select>
  )
}
// Start year / End year pair with a "Present" toggle for the end.
function YearRange({ startYear, endYear, onChange, presentLabel = 'Present (current)' }) {
  const present = (endYear || '').toLowerCase() === 'present'
  return (
    <div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <p className="text-[11px] font-semibold text-slate-500 mb-1">Start year</p>
          <YearSelect value={startYear} onChange={v => onChange({ startYear: v, endYear })} />
        </div>
        <div>
          <p className="text-[11px] font-semibold text-slate-500 mb-1">End year</p>
          <YearSelect value={present ? '' : endYear} disabled={present} onChange={v => onChange({ startYear, endYear: v })} />
        </div>
      </div>
      <label className="inline-flex items-center gap-2 mt-2 text-xs text-slate-600 cursor-pointer select-none">
        <input type="checkbox" checked={present} onChange={e => onChange({ startYear, endYear: e.target.checked ? 'Present' : '' })} className="w-3.5 h-3.5 accent-indigo-600" />
        {presentLabel}
      </label>
    </div>
  )
}

function ExpCard({ item, onSave, onDelete }) {
  const [editing, setEditing] = useState(!item.title)
  const [d, setD] = useState(item)
  const [bullet, setBullet] = useState('')
  function addBullet() {
    const v = bullet.trim(); if (!v) return
    setD(x => ({ ...x, bullets: [...(x.bullets || []), v] })); setBullet('')
  }
  function handleSave() {
    // Keep `dates` in sync for display + downstream (interview priming reads it).
    const merged = { ...d, dates: joinDates(d.startYear, d.endYear) }
    onSave(merged); setEditing(false)
  }
  const displayLoc = [item.city, item.country].filter(Boolean).join(', ')
  const displayDates = joinDates(item.startYear, item.endYear) || item.dates || ''
  if (!editing) return (
    <div className="border border-slate-200 rounded-xl p-4 hover:border-slate-300 transition">
      <div className="flex justify-between gap-3 mb-1">
        <div>
          <p className="text-sm font-bold text-slate-900">{item.title || '(no title)'}</p>
          <p className="text-xs text-slate-500 mt-0.5">{item.company}{displayLoc ? ` · ${displayLoc}` : ''}{displayDates ? ` · ${displayDates}` : ''}</p>
        </div>
        <div className="flex gap-1.5 flex-shrink-0">
          <button onClick={() => setEditing(true)} className="text-xs font-semibold px-2.5 py-1 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 transition">Edit</button>
          <button onClick={onDelete} className="text-xs font-semibold px-2.5 py-1 border border-red-100 rounded-lg text-red-500 hover:bg-red-50 transition">✕</button>
        </div>
      </div>
      {(item.bullets || []).map((b, i) => <p key={i} className="text-xs text-slate-500 mt-1.5 pl-3 before:content-['·'] before:mr-1.5">{b}</p>)}
    </div>
  )
  return (
    <div className="border border-indigo-200 rounded-xl p-4 space-y-3 bg-indigo-50/30">
      <div className="grid grid-cols-2 gap-2">
        {[['title','Role'],['company','Company'],['city','City'],['country','Country']].map(([k,ph]) => (
          <input key={k} value={d[k]||''} onChange={e=>setD(x=>({...x,[k]:e.target.value}))} placeholder={ph}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 bg-white transition" />
        ))}
      </div>

      <YearRange startYear={d.startYear} endYear={d.endYear} onChange={v => setD(x => ({ ...x, ...v }))} presentLabel="I currently work here" />

      <div className="space-y-1.5">
        {(d.bullets||[]).map((b,i)=>(
          <div key={i} className="flex items-center gap-2 text-xs text-slate-600">
            <span className="text-slate-400">·</span><span className="flex-1">{b}</span>
            <button onClick={()=>setD(x=>({...x,bullets:x.bullets.filter((_,j)=>j!==i)}))} className="text-slate-300 hover:text-red-400 transition">✕</button>
          </div>
        ))}
        <div className="flex gap-1.5 mt-1">
          <input value={bullet} onChange={e=>setBullet(e.target.value)} onKeyDown={e=>e.key==='Enter'&&addBullet()} placeholder="Add bullet point"
            className="flex-1 rounded-lg border border-slate-300 px-3 py-1.5 text-xs focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 bg-white transition" />
          <button onClick={addBullet} className="text-xs font-semibold px-2.5 py-1 border border-slate-200 rounded-lg hover:bg-white transition">+</button>
        </div>
      </div>
      <div className="flex gap-2 pt-1">
        <button onClick={handleSave} className="text-xs font-semibold px-3.5 py-1.5 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition">Save</button>
        <button onClick={()=>{setD(item);setEditing(false)}} className="text-xs font-semibold px-3.5 py-1.5 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 transition">Cancel</button>
      </div>
    </div>
  )
}

function EduCard({ item, onSave, onDelete }) {
  const [editing, setEditing] = useState(!item.degree)
  const [d, setD] = useState(item)
  function handleSave() {
    const merged = { ...d, year: joinDates(d.startYear, d.endYear) }
    onSave(merged); setEditing(false)
  }
  const displayYear = joinDates(item.startYear, item.endYear) || item.year || ''
  if (!editing) return (
    <div className="border border-slate-200 rounded-xl p-4 flex justify-between gap-3 hover:border-slate-300 transition">
      <div>
        <p className="text-sm font-bold text-slate-900">{item.degree || '(no degree)'}{item.major ? ` · ${item.major}` : ''}</p>
        <p className="text-xs text-slate-500 mt-0.5">{item.school}{displayYear ? ` · ${displayYear}` : ''}{item.gpa ? ` · GPA ${item.gpa}` : ''}</p>
      </div>
      <div className="flex gap-1.5 flex-shrink-0">
        <button onClick={()=>setEditing(true)} className="text-xs font-semibold px-2.5 py-1 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 transition">Edit</button>
        <button onClick={onDelete} className="text-xs font-semibold px-2.5 py-1 border border-red-100 rounded-lg text-red-500 hover:bg-red-50 transition">✕</button>
      </div>
    </div>
  )
  return (
    <div className="border border-indigo-200 rounded-xl p-4 space-y-3 bg-indigo-50/30">
      <div className="grid grid-cols-2 gap-2">
        {[['school','School'],['degree','Degree'],['major','Major'],['gpa','GPA']].map(([k,ph])=>(
          <input key={k} value={d[k]||''} onChange={e=>setD(x=>({...x,[k]:e.target.value}))} placeholder={ph}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 bg-white transition" />
        ))}
      </div>
      <YearRange startYear={d.startYear} endYear={d.endYear} onChange={v => setD(x => ({ ...x, ...v }))} presentLabel="Currently studying" />
      <div className="flex gap-2">
        <button onClick={handleSave} className="text-xs font-semibold px-3.5 py-1.5 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition">Save</button>
        <button onClick={()=>{setD(item);setEditing(false)}} className="text-xs font-semibold px-3.5 py-1.5 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 transition">Cancel</button>
      </div>
    </div>
  )
}

function ProjCard({ item, onSave, onDelete }) {
  const [editing, setEditing] = useState(!item.name)
  const [d, setD] = useState(item)
  if (!editing) return (
    <div className="border border-slate-200 rounded-xl p-4 flex justify-between gap-3 hover:border-slate-300 transition">
      <div className="flex-1">
        <p className="text-sm font-bold text-slate-900">{item.name || '(no name)'}</p>
        {item.tech && <p className="text-xs text-slate-400 mt-0.5">{item.tech}</p>}
        {item.description && <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">{item.description}</p>}
      </div>
      <div className="flex gap-1.5 flex-shrink-0">
        <button onClick={()=>setEditing(true)} className="text-xs font-semibold px-2.5 py-1 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 transition">Edit</button>
        <button onClick={onDelete} className="text-xs font-semibold px-2.5 py-1 border border-red-100 rounded-lg text-red-500 hover:bg-red-50 transition">✕</button>
      </div>
    </div>
  )
  return (
    <div className="border border-indigo-200 rounded-xl p-4 space-y-2 bg-indigo-50/30">
      <input value={d.name||''} onChange={e=>setD(x=>({...x,name:e.target.value}))} placeholder="Project name"
        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 bg-white transition" />
      <input value={d.tech||''} onChange={e=>setD(x=>({...x,tech:e.target.value}))} placeholder="Tech stack (React, Node.js…)"
        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 bg-white transition" />
      <YearRange startYear={d.startYear} endYear={d.endYear} onChange={v => setD(x => ({ ...x, ...v }))} presentLabel="Ongoing" />
      <textarea value={d.description||''} onChange={e=>setD(x=>({...x,description:e.target.value}))} placeholder="Description" rows={3}
        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 bg-white resize-none transition" />
      <div className="flex gap-2">
        <button onClick={()=>{onSave(d);setEditing(false)}} className="text-xs font-semibold px-3.5 py-1.5 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition">Save</button>
        <button onClick={()=>{setD(item);setEditing(false)}} className="text-xs font-semibold px-3.5 py-1.5 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 transition">Cancel</button>
      </div>
    </div>
  )
}

// ── Main ─────────────────────────────────────────────────────────────────────
export default function DashboardProfilePage() {
  const params = useSearchParams()
  const router = useRouter()
  const tabParam = params?.get('tab')

  const [profile, setProfile] = useState(null)
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState(tabParam || 'resume')
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [parsing, setParsing] = useState(false)
  const [analyzePhase, setAnalyzePhase] = useState('idle') // idle|analyzing|done|error
  const [analyzeError, setAnalyzeError] = useState('')
  const [msg, setMsg] = useState({ type: '', text: '' })

  const [name, setName] = useState('')
  const [linkedin, setLinkedin] = useState('')
  const [noLinkedin, setNoLinkedin] = useState(false)
  const [github, setGithub] = useState('')
  const [certs, setCerts] = useState([])
  const [newCert, setNewCert] = useState({ name: '', issuer: '', year: '', url: '' })
  const [sections, setSections] = useState(null)
  // Location / Availability / Work preferences / Communications all live under
  // one JSONB column, keyed by tab. The API merges per-key, so saving one tab
  // never clobbers another.
  const [prefs, setPrefs] = useState({})

  const fileRef = useRef(null)

  function flash(type, text) { setMsg({ type, text }); setTimeout(() => setMsg({ type: '', text: '' }), 3500) }

  async function load() {
    setLoading(true)
    try {
      const res = await fetch('/api/profile', { cache: 'no-store' })
      const data = await res.json()
      setProfile(data.profile); setUser(data.user)
      setName(data.profile?.full_name || '')
      setLinkedin(data.profile?.linkedin_url || '')
      setGithub(data.profile?.github_url || '')
      setCerts(data.profile?.certificates || [])
      setSections(data.profile?.resume_sections || null)
      setPrefs(data.profile?.profile_prefs || {})
    } finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])
  useEffect(() => { if (tabParam) setActiveTab(tabParam) }, [tabParam])

  async function save(payload) {
    setSaving(true)
    try {
      const res = await fetch('/api/profile', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      if (!res.ok) throw new Error('Save failed')
      flash('ok', 'Saved.')
      await load()
    } catch (e) { flash('err', e.message) } finally { setSaving(false) }
  }

  // Read/update a single field inside one prefs group, then persist that group.
  const pref = (group, field, fallback = '') => prefs?.[group]?.[field] ?? fallback
  const setPref = (group, field, value) =>
    setPrefs(p => ({ ...p, [group]: { ...(p?.[group] || {}), [field]: value } }))
  const savePrefs = (group) => save({ profile_prefs: { [group]: prefs?.[group] || {} } })

  async function onUpload(e) {
    const file = e.target.files?.[0]; if (!file) return
    setUploading(true)
    setAnalyzeError('')
    setAnalyzePhase('analyzing')   // show the animated analysis overlay
    try {
      const fd = new FormData(); fd.append('file', file)
      const r = await fetch('/api/upload-resume', { method: 'POST', body: fd })
      if (!r.ok) { const j = await r.json().catch(() => ({})); throw new Error(j?.error || 'Failed') }
      const { text, pages, chars } = await r.json()
      await save({ resume_text: text, resume_filename: file.name, resume_pages: pages, resume_chars: chars })
      // Bust the App Router client cache so other server-rendered pages (e.g. the
      // Expert Interview gate) don't serve a stale "no resume" render after this.
      router.refresh()
      if (fileRef.current) fileRef.current.value = ''

      // Parse sections (AI) — the bulk of the analysis. The overlay completes to
      // 100% exactly when this resolves.
      const pr = await fetch('/api/parse-resume', { method: 'POST' })
      if (!pr.ok) throw new Error('Could not read enough detail from this resume.')
      const data = await pr.json()
      setSections(data.sections)

      setAnalyzePhase('done')
      flash('ok', 'Resume analyzed — review and edit the details below.')
    } catch (e) {
      setAnalyzeError(e.message)
      setAnalyzePhase('error')
      flash('err', e.message)
    } finally {
      setUploading(false)
    }
  }

  // Re-analyze the already-uploaded resume (used by the "re-parse" buttons).
  async function parseResumeSections() {
    setAnalyzeError('')
    setAnalyzePhase('analyzing')
    try {
      const r = await fetch('/api/parse-resume', { method: 'POST' })
      if (!r.ok) throw new Error('Could not read enough detail from this resume.')
      const data = await r.json()
      setSections(data.sections)
      setAnalyzePhase('done')
      flash('ok', 'Resume analyzed — review and edit the details below.')
    } catch (e) {
      setAnalyzeError(e.message)
      setAnalyzePhase('error')
      flash('err', e.message)
    }
  }

  async function saveSections(updated) {
    setSections(updated)
    await save({ resume_sections: updated })
  }

  const tabs = [
    { id: 'resume', label: 'Resume' },
    { id: 'personal', label: 'Personal info' },
    { id: 'location', label: 'Location & work authorization' },
    { id: 'availability', label: 'Availability' },
    { id: 'preferences', label: 'Work preferences' },
    { id: 'communications', label: 'Communications' },
    { id: 'certs', label: 'Certificates' },
    { id: 'account', label: 'Account' },
  ]

  if (loading) return <div className="max-w-5xl mx-auto pt-10 text-sm text-slate-400">Loading…</div>

  return (
    <div className="max-w-5xl mx-auto">
      {/* Resume analysis overlay — animated checklist while parsing */}
      <ResumeAnalyzer phase={analyzePhase} error={analyzeError} onClose={() => setAnalyzePhase('idle')} />

      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl md:text-4xl font-black tracking-tight text-slate-900">Profile</h1>
        <p className="text-slate-500 mt-1">{user?.email}</p>
      </div>

      {/* Flash message */}
      {msg.text && (
        <div className={`mb-6 px-5 py-3.5 rounded-2xl text-sm font-medium ${msg.type === 'ok' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
          {msg.text}
        </div>
      )}

      {/* Two-column: left sub-nav + content (Mercor-style) */}
      <div className="grid md:grid-cols-[248px_1fr] gap-8 items-start">
        <nav className="md:sticky md:top-6 flex md:flex-col gap-0.5 overflow-x-auto pb-2 md:pb-0">
          {tabs.map(t => (
            <button key={t.id} onClick={() => setActiveTab(t.id)}
              className={`text-left whitespace-nowrap px-4 py-2.5 rounded-xl text-sm font-semibold transition ${
                activeTab === t.id ? 'bg-indigo-50 text-indigo-700' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
              }`}>
              {t.label}
            </button>
          ))}
        </nav>

        <div className="min-w-0">
      {/* ── Personal Info ─────────────────────────────────────────────── */}
      {activeTab === 'personal' && (
        <div className="max-w-2xl bg-white border border-slate-200 rounded-2xl p-6 space-y-6">
          <div>
            <label className="block text-xs font-black uppercase tracking-[0.2em] text-slate-500 mb-2">Full name</label>
            <div className="flex gap-3">
              <input value={name} onChange={e => setName(e.target.value)} placeholder="Your full name"
                className="flex-1 rounded-xl border border-slate-300 px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition" />
              <button onClick={() => save({ full_name: name })} disabled={saving || !name.trim()}
                className="px-5 py-2.5 text-sm font-semibold bg-slate-900 text-white rounded-xl hover:bg-slate-800 disabled:opacity-50 transition whitespace-nowrap">
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
          <div>
            <label className="block text-xs font-black uppercase tracking-[0.2em] text-slate-500 mb-2">Email</label>
            <p className="text-sm text-slate-700 border border-slate-200 rounded-xl px-4 py-2.5 bg-slate-50">{user?.email}</p>
          </div>
        </div>
      )}

      {/* ── Resume (upload + parsed data + links) ─────────────────────── */}
      {activeTab === 'resume' && (
        <div className="max-w-3xl space-y-6">
          {/* Resume upload */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <label className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">Resume (PDF)</label>
              {profile?.has_resume && <span className="text-xs font-bold text-emerald-600">✓ On file</span>}
            </div>
            {profile?.has_resume && (
              <div className="flex items-center gap-3 border border-slate-200 rounded-xl px-4 py-3 mb-4 bg-slate-50/60">
                <svg className="w-8 h-8 text-slate-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-900 truncate">{profile.resume_filename || 'resume.pdf'}</p>
                  <p className="text-xs text-slate-500">{profile.resume_pages} pages · {profile.resume_chars?.toLocaleString()} chars</p>
                </div>
              </div>
            )}
            <div className="rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50/50 px-6 py-8 text-center hover:border-indigo-300 transition">
              <svg className="w-8 h-8 text-slate-400 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 16V4m0 0L7 9m5-5l5 5M5 20h14" />
              </svg>
              <p className="text-sm text-slate-500 mb-3">{profile?.has_resume ? 'Upload a new PDF to replace your resume' : 'Upload your resume as a PDF'}</p>
              <input ref={fileRef} type="file" accept="application/pdf,.pdf" onChange={onUpload} disabled={uploading}
                className="block w-full text-sm text-slate-500 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:uppercase file:tracking-wide file:bg-indigo-600 file:text-white hover:file:bg-indigo-700 file:cursor-pointer cursor-pointer transition" />
              {uploading && <p className="text-xs text-indigo-600 mt-3 animate-pulse font-semibold">Uploading & reading your PDF…</p>}
            </div>
          </div>

          {/* Parsed resume — shown right after upload so you can review + edit */}
          {profile?.has_resume && (
            <>
              <div className="flex items-center justify-between px-1">
                <h2 className="text-xl font-bold text-slate-900">Parsed Resume</h2>
                {sections && !parsing && (
                  <button onClick={parseResumeSections} disabled={parsing}
                    className="text-xs font-semibold text-slate-400 hover:text-indigo-600 disabled:opacity-50 transition">
                    ↺ Re-parse from PDF
                  </button>
                )}
              </div>
              <p className="text-sm text-slate-500 -mt-4 px-1">This is what our AI read from your resume. Review it and edit anything that's off — it powers your interviews.</p>

              {parsing ? (
                <div className="bg-white border border-slate-200 rounded-2xl p-6">
                  <p className="text-sm text-indigo-600 animate-pulse font-semibold">Reading your resume…</p>
                </div>
              ) : !sections ? (
                <div className="bg-white border border-slate-200 rounded-2xl p-6 text-center">
                  <p className="text-sm text-slate-500 mb-4">We haven't parsed your resume into sections yet.</p>
                  <button onClick={parseResumeSections} className="text-sm font-semibold px-5 py-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition">
                    Parse my resume
                  </button>
                </div>
              ) : (
                <>
                  {/* Summary */}
                  <div className="bg-white border border-slate-200 rounded-2xl p-6">
                    <h3 className="text-lg font-bold text-slate-900 mb-4">Summary</h3>
                    <textarea value={sections?.summary || ''} onChange={e => setSections(s => ({ ...s, summary: e.target.value }))}
                      rows={4} placeholder="Your professional summary"
                      className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 resize-none transition" />
                    <button onClick={() => save({ resume_sections: sections })} disabled={saving}
                      className="mt-3 text-sm font-semibold px-5 py-2 bg-slate-900 text-white rounded-xl hover:bg-slate-800 disabled:opacity-50 transition">
                      {saving ? 'Saving…' : 'Save Summary'}
                    </button>
                  </div>

                  {/* Skills */}
                  <div className="bg-white border border-slate-200 rounded-2xl p-6">
                    <h3 className="text-lg font-bold text-slate-900 mb-4">Skills</h3>
                    <SkillsEditor skills={sections?.skills || []} onChange={(v) => saveSections({ ...sections, skills: v })} />
                  </div>

                  {/* Experience */}
                  <div className="bg-white border border-slate-200 rounded-2xl p-6">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-bold text-slate-900">Experience</h3>
                      <button onClick={() => saveSections({ ...sections, experience: [...(sections?.experience||[]), { id: uid(), title:'', company:'', location:'', dates:'', bullets:[] }] })}
                        className="text-xs font-semibold px-3 py-1.5 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 transition">+ Add</button>
                    </div>
                    <div className="space-y-3">
                      {(sections?.experience || []).map(exp => (
                        <ExpCard key={exp.id} item={exp}
                          onSave={d => saveSections({ ...sections, experience: sections.experience.map(e => e.id===exp.id ? {...d,id:exp.id} : e) })}
                          onDelete={() => saveSections({ ...sections, experience: sections.experience.filter(e => e.id!==exp.id) })} />
                      ))}
                      {!(sections?.experience?.length) && <p className="text-sm text-slate-400">No experience found.</p>}
                    </div>
                  </div>

                  {/* Education */}
                  <div className="bg-white border border-slate-200 rounded-2xl p-6">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-bold text-slate-900">Education</h3>
                      <button onClick={() => saveSections({ ...sections, education: [...(sections?.education||[]), { id: uid(), degree:'', school:'', year:'' }] })}
                        className="text-xs font-semibold px-3 py-1.5 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 transition">+ Add</button>
                    </div>
                    <div className="space-y-3">
                      {(sections?.education || []).map(edu => (
                        <EduCard key={edu.id} item={edu}
                          onSave={d => saveSections({ ...sections, education: sections.education.map(e => e.id===edu.id ? {...d,id:edu.id} : e) })}
                          onDelete={() => saveSections({ ...sections, education: sections.education.filter(e => e.id!==edu.id) })} />
                      ))}
                      {!(sections?.education?.length) && <p className="text-sm text-slate-400">No education found.</p>}
                    </div>
                  </div>

                  {/* Projects */}
                  <div className="bg-white border border-slate-200 rounded-2xl p-6">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-bold text-slate-900">Projects</h3>
                      <button onClick={() => saveSections({ ...sections, projects: [...(sections?.projects||[]), { id: uid(), name:'', tech:'', description:'' }] })}
                        className="text-xs font-semibold px-3 py-1.5 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 transition">+ Add</button>
                    </div>
                    <div className="space-y-3">
                      {(sections?.projects || []).map(proj => (
                        <ProjCard key={proj.id} item={proj}
                          onSave={d => saveSections({ ...sections, projects: sections.projects.map(p => p.id===proj.id ? {...d,id:proj.id} : p) })}
                          onDelete={() => saveSections({ ...sections, projects: sections.projects.filter(p => p.id!==proj.id) })} />
                      ))}
                      {!(sections?.projects?.length) && <p className="text-sm text-slate-400">No projects found.</p>}
                    </div>
                  </div>

                  {/* Coding Profiles */}
                  <div className="bg-white border border-slate-200 rounded-2xl p-6">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-bold text-slate-900">Coding Profiles</h3>
                      <button onClick={() => setSections(s => ({ ...s, coding_profiles: [...(s?.coding_profiles||[]), { id: uid(), platform:'', username:'', url:'' }] }))}
                        className="text-xs font-semibold px-3 py-1.5 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 transition">+ Add</button>
                    </div>
                    <div className="space-y-2.5">
                      {(sections?.coding_profiles || []).map(cp => (
                        <div key={cp.id} className="flex flex-wrap items-center gap-2">
                          <input value={cp.platform||''} placeholder="Platform (e.g. LeetCode)"
                            onChange={e => setSections(s => ({ ...s, coding_profiles: s.coding_profiles.map(x => x.id===cp.id ? {...x, platform:e.target.value} : x) }))}
                            className="w-40 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:border-indigo-500 transition" />
                          <input value={cp.url||''} placeholder="Profile URL"
                            onChange={e => setSections(s => ({ ...s, coding_profiles: s.coding_profiles.map(x => x.id===cp.id ? {...x, url:e.target.value} : x) }))}
                            className="flex-1 min-w-[180px] rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:border-indigo-500 transition" />
                          <button onClick={() => setSections(s => ({ ...s, coding_profiles: s.coding_profiles.filter(x => x.id!==cp.id) }))}
                            className="text-slate-300 hover:text-red-500 px-1 transition" aria-label="Remove">✕</button>
                        </div>
                      ))}
                      {!(sections?.coding_profiles?.length) && <p className="text-sm text-slate-400">No coding profiles found.</p>}
                    </div>
                    <button onClick={() => save({ resume_sections: sections })} disabled={saving}
                      className="mt-3 text-sm font-semibold px-5 py-2 bg-slate-900 text-white rounded-xl hover:bg-slate-800 disabled:opacity-50 transition">
                      {saving ? 'Saving…' : 'Save Coding Profiles'}
                    </button>
                  </div>

                  {/* Links */}
                  <div className="bg-white border border-slate-200 rounded-2xl p-6">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-bold text-slate-900">Links</h3>
                      <button onClick={() => setSections(s => ({ ...s, links: [...(s?.links||[]), { id: uid(), label:'', url:'' }] }))}
                        className="text-xs font-semibold px-3 py-1.5 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 transition">+ Add</button>
                    </div>
                    <div className="space-y-2.5">
                      {(sections?.links || []).map(ln => (
                        <div key={ln.id} className="flex flex-wrap items-center gap-2">
                          <input value={ln.label||''} placeholder="Label (e.g. Portfolio)"
                            onChange={e => setSections(s => ({ ...s, links: s.links.map(x => x.id===ln.id ? {...x, label:e.target.value} : x) }))}
                            className="w-40 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:border-indigo-500 transition" />
                          <input value={ln.url||''} placeholder="https://…"
                            onChange={e => setSections(s => ({ ...s, links: s.links.map(x => x.id===ln.id ? {...x, url:e.target.value} : x) }))}
                            className="flex-1 min-w-[180px] rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:border-indigo-500 transition" />
                          <button onClick={() => setSections(s => ({ ...s, links: s.links.filter(x => x.id!==ln.id) }))}
                            className="text-slate-300 hover:text-red-500 px-1 transition" aria-label="Remove">✕</button>
                        </div>
                      ))}
                      {!(sections?.links?.length) && <p className="text-sm text-slate-400">No links found.</p>}
                    </div>
                    <button onClick={() => save({ resume_sections: sections })} disabled={saving}
                      className="mt-3 text-sm font-semibold px-5 py-2 bg-slate-900 text-white rounded-xl hover:bg-slate-800 disabled:opacity-50 transition">
                      {saving ? 'Saving…' : 'Save Links'}
                    </button>
                  </div>

                  {/* Publications */}
                  <div className="bg-white border border-slate-200 rounded-2xl p-6">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-bold text-slate-900">Publications</h3>
                      <button onClick={() => setSections(s => ({ ...s, publications: [...(s?.publications||[]), { id: uid(), title:'', description:'' }] }))}
                        className="text-xs font-semibold px-3 py-1.5 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 transition">+ Add</button>
                    </div>
                    <div className="space-y-2.5">
                      {(sections?.publications || []).map(pb => (
                        <div key={pb.id} className="space-y-2 border border-slate-100 rounded-xl p-3">
                          <div className="flex items-center gap-2">
                            <input value={pb.title||''} placeholder="Title"
                              onChange={e => setSections(s => ({ ...s, publications: s.publications.map(x => x.id===pb.id ? {...x, title:e.target.value} : x) }))}
                              className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:border-indigo-500 transition" />
                            <button onClick={() => setSections(s => ({ ...s, publications: s.publications.filter(x => x.id!==pb.id) }))} className="text-slate-300 hover:text-red-500 px-1" aria-label="Remove">✕</button>
                          </div>
                          <input value={pb.description||''} placeholder="Venue / brief note"
                            onChange={e => setSections(s => ({ ...s, publications: s.publications.map(x => x.id===pb.id ? {...x, description:e.target.value} : x) }))}
                            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:border-indigo-500 transition" />
                        </div>
                      ))}
                      {!(sections?.publications?.length) && <p className="text-sm text-slate-400">No publications found.</p>}
                    </div>
                    <button onClick={() => save({ resume_sections: sections })} disabled={saving} className="mt-3 text-sm font-semibold px-5 py-2 bg-slate-900 text-white rounded-xl hover:bg-slate-800 disabled:opacity-50 transition">{saving ? 'Saving…' : 'Save Publications'}</button>
                  </div>

                  {/* Certifications */}
                  <div className="bg-white border border-slate-200 rounded-2xl p-6">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-bold text-slate-900">Certifications</h3>
                      <button onClick={() => setSections(s => ({ ...s, certifications: [...(s?.certifications||[]), { id: uid(), name:'', issuer:'', year:'' }] }))}
                        className="text-xs font-semibold px-3 py-1.5 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 transition">+ Add</button>
                    </div>
                    <div className="space-y-2.5">
                      {(sections?.certifications || []).map(ct => (
                        <div key={ct.id} className="flex flex-wrap items-center gap-2">
                          <input value={ct.name||''} placeholder="Certification"
                            onChange={e => setSections(s => ({ ...s, certifications: s.certifications.map(x => x.id===ct.id ? {...x, name:e.target.value} : x) }))}
                            className="flex-1 min-w-[160px] rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:border-indigo-500 transition" />
                          <input value={ct.issuer||''} placeholder="Issuer"
                            onChange={e => setSections(s => ({ ...s, certifications: s.certifications.map(x => x.id===ct.id ? {...x, issuer:e.target.value} : x) }))}
                            className="w-36 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:border-indigo-500 transition" />
                          <input value={ct.year||''} placeholder="Year"
                            onChange={e => setSections(s => ({ ...s, certifications: s.certifications.map(x => x.id===ct.id ? {...x, year:e.target.value} : x) }))}
                            className="w-20 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:border-indigo-500 transition" />
                          <button onClick={() => setSections(s => ({ ...s, certifications: s.certifications.filter(x => x.id!==ct.id) }))} className="text-slate-300 hover:text-red-500 px-1" aria-label="Remove">✕</button>
                        </div>
                      ))}
                      {!(sections?.certifications?.length) && <p className="text-sm text-slate-400">No certifications found.</p>}
                    </div>
                    <button onClick={() => save({ resume_sections: sections })} disabled={saving} className="mt-3 text-sm font-semibold px-5 py-2 bg-slate-900 text-white rounded-xl hover:bg-slate-800 disabled:opacity-50 transition">{saving ? 'Saving…' : 'Save Certifications'}</button>
                  </div>

                  {/* Awards */}
                  <div className="bg-white border border-slate-200 rounded-2xl p-6">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-bold text-slate-900">Awards</h3>
                      <button onClick={() => setSections(s => ({ ...s, awards: [...(s?.awards||[]), { id: uid(), title:'', year:'' }] }))}
                        className="text-xs font-semibold px-3 py-1.5 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 transition">+ Add</button>
                    </div>
                    <div className="space-y-2.5">
                      {(sections?.awards || []).map(aw => (
                        <div key={aw.id} className="flex flex-wrap items-center gap-2">
                          <input value={aw.title||''} placeholder="Award"
                            onChange={e => setSections(s => ({ ...s, awards: s.awards.map(x => x.id===aw.id ? {...x, title:e.target.value} : x) }))}
                            className="flex-1 min-w-[180px] rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:border-indigo-500 transition" />
                          <input value={aw.year||''} placeholder="Year"
                            onChange={e => setSections(s => ({ ...s, awards: s.awards.map(x => x.id===aw.id ? {...x, year:e.target.value} : x) }))}
                            className="w-20 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:border-indigo-500 transition" />
                          <button onClick={() => setSections(s => ({ ...s, awards: s.awards.filter(x => x.id!==aw.id) }))} className="text-slate-300 hover:text-red-500 px-1" aria-label="Remove">✕</button>
                        </div>
                      ))}
                      {!(sections?.awards?.length) && <p className="text-sm text-slate-400">No awards found.</p>}
                    </div>
                    <button onClick={() => save({ resume_sections: sections })} disabled={saving} className="mt-3 text-sm font-semibold px-5 py-2 bg-slate-900 text-white rounded-xl hover:bg-slate-800 disabled:opacity-50 transition">{saving ? 'Saving…' : 'Save Awards'}</button>
                  </div>

                  {/* Languages */}
                  <div className="bg-white border border-slate-200 rounded-2xl p-6">
                    <h3 className="text-lg font-bold text-slate-900 mb-4">Languages</h3>
                    <SkillsEditor skills={sections?.languages || []} onChange={(v) => saveSections({ ...sections, languages: v })} />
                  </div>

                  {/* Hobbies */}
                  <div className="bg-white border border-slate-200 rounded-2xl p-6">
                    <h3 className="text-lg font-bold text-slate-900 mb-4">Hobbies</h3>
                    <SkillsEditor skills={sections?.hobbies || []} onChange={(v) => saveSections({ ...sections, hobbies: v })} />
                  </div>
                </>
              )}
            </>
          )}

          {/* Links */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-6">
            <div>
              <label className="block text-xs font-black uppercase tracking-[0.2em] text-slate-500 mb-2">LinkedIn URL <span className="text-red-500">*</span></label>
              <div className="flex gap-3">
                <input type="url" value={linkedin} disabled={noLinkedin} onChange={e => setLinkedin(e.target.value)} placeholder="https://linkedin.com/in/yourname"
                  className="flex-1 rounded-xl border border-slate-300 px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 disabled:bg-slate-100 disabled:text-slate-400 transition" />
                <button onClick={() => save({ linkedin_url: linkedin })} disabled={saving || noLinkedin}
                  className="px-5 py-2.5 text-sm font-semibold bg-slate-900 text-white rounded-xl hover:bg-slate-800 disabled:opacity-50 transition whitespace-nowrap">
                  {saving ? 'Saving…' : 'Save'}
                </button>
              </div>
              <p className="text-xs text-slate-400 mt-2">We use this public profile URL for your application.</p>
              <label className="inline-flex items-center gap-2 mt-3 text-sm text-slate-600 cursor-pointer select-none">
                <input type="checkbox" checked={noLinkedin} onChange={e => setNoLinkedin(e.target.checked)} className="w-4 h-4 accent-indigo-600" />
                I don&apos;t have a LinkedIn
              </label>

              {/* Verify LinkedIn */}
              <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div>
                    <p className="text-sm font-semibold text-slate-800">Verify your LinkedIn account <span className="text-slate-400 font-normal">· Optional</span></p>
                    <p className="text-xs text-slate-500 mt-0.5">Verified LinkedIn profiles have 6x higher chances of getting an offer.</p>
                  </div>
                  <a href={linkedin || 'https://linkedin.com'} target="_blank" rel="noopener noreferrer"
                    className={`px-4 py-2 text-sm font-semibold rounded-xl transition whitespace-nowrap ${linkedin && !noLinkedin ? 'bg-[#0a66c2] text-white hover:bg-[#0954a0]' : 'bg-slate-200 text-slate-400 pointer-events-none'}`}>
                    Verify
                  </a>
                </div>
              </div>
            </div>
            <Divider />
            <div>
              <label className="block text-xs font-black uppercase tracking-[0.2em] text-slate-500 mb-2">GitHub URL</label>
              <div className="flex gap-3">
                <input type="url" value={github} onChange={e => setGithub(e.target.value)} placeholder="https://github.com/yourusername"
                  className="flex-1 rounded-xl border border-slate-300 px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition" />
                <button onClick={() => save({ github_url: github })} disabled={saving}
                  className="px-5 py-2.5 text-sm font-semibold bg-slate-900 text-white rounded-xl hover:bg-slate-800 disabled:opacity-50 transition whitespace-nowrap">
                  {saving ? 'Saving…' : 'Save'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Certificates ──────────────────────────────────────────────── */}
      {activeTab === 'certs' && (
        <div className="max-w-2xl space-y-6">
          {certs.length > 0 && (
            <div className="bg-white border border-slate-200 rounded-2xl divide-y divide-slate-100 overflow-hidden">
              {certs.map((c, i) => (
                <div key={i} className="flex items-start justify-between px-5 py-4 gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{c.name}</p>
                    {c.issuer && <p className="text-xs text-slate-500 mt-0.5">{c.issuer}{c.year ? ` · ${c.year}` : ''}</p>}
                    {c.url && <a href={c.url} target="_blank" rel="noopener noreferrer" className="text-xs text-indigo-600 hover:text-indigo-700 underline underline-offset-2">View</a>}
                  </div>
                  <button onClick={() => { const u = certs.filter((_,j)=>j!==i); setCerts(u); save({ certificates: u }) }}
                    className="text-slate-300 hover:text-red-400 text-sm flex-shrink-0 transition">✕</button>
                </div>
              ))}
            </div>
          )}

          <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">Add Certificate</p>
            <div className="grid grid-cols-2 gap-3">
              {[['Name *','text','name','AWS Solutions Architect'],['Issuer','text','issuer','Amazon Web Services'],['Year','text','year','2024'],['URL','url','url','https://…']].map(([label,type,key,ph])=>(
                <div key={key}>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1.5">{label}</label>
                  <input type={type} value={newCert[key]} onChange={e=>setNewCert(p=>({...p,[key]:e.target.value}))} placeholder={ph}
                    className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm text-slate-900 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition" />
                </div>
              ))}
            </div>
            <button
              onClick={() => { if (!newCert.name.trim()) return; const u=[...certs,{...newCert,name:newCert.name.trim()}]; setCerts(u); setNewCert({name:'',issuer:'',year:'',url:''}); save({ certificates: u }) }}
              disabled={!newCert.name.trim() || saving}
              className="text-sm font-semibold px-5 py-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-50 transition">
              Add Certificate
            </button>
          </div>
        </div>
      )}

      {/* ── Location & work authorization ─────────────────────────────── */}
      {activeTab === 'location' && (
        <div className="max-w-2xl bg-white border border-slate-200 rounded-2xl p-6 space-y-6">
          <p className="text-sm text-slate-500">Where you are and what you&apos;re allowed to work. Companies filter on this, so keep it accurate.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <TextField label="Country" value={pref('location', 'country')} onChange={v => setPref('location', 'country', v)} placeholder="e.g. Pakistan" />
            <TextField label="City" value={pref('location', 'city')} onChange={v => setPref('location', 'city', v)} placeholder="e.g. Lahore" />
          </div>
          <TextField label="Time zone" value={pref('location', 'timezone')} onChange={v => setPref('location', 'timezone', v)} placeholder="e.g. PKT (UTC+5)"
            hint="Used to suggest interview times that actually work for you." />
          <SelectField label="Work authorization" value={pref('location', 'work_auth')} onChange={v => setPref('location', 'work_auth', v)}
            options={['Citizen', 'Permanent resident', 'Work visa', 'Student visa', 'Need sponsorship', 'Other']} />
          <Divider />
          <div className="space-y-4">
            <Toggle label="I need visa sponsorship" hint="Tells companies upfront so nobody wastes a round."
              checked={pref('location', 'needs_sponsorship', false)} onChange={v => setPref('location', 'needs_sponsorship', v)} />
            <Toggle label="I'm open to relocating" hint="Including to another country for the right role."
              checked={pref('location', 'open_to_relocate', false)} onChange={v => setPref('location', 'open_to_relocate', v)} />
          </div>
          <SaveBar saving={saving} onSave={() => savePrefs('location')} />
        </div>
      )}

      {/* ── Availability ──────────────────────────────────────────────── */}
      {activeTab === 'availability' && (
        <div className="max-w-2xl bg-white border border-slate-200 rounded-2xl p-6 space-y-6">
          <p className="text-sm text-slate-500">When you can start and how much you can take on.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <TextField label="Available from" type="date" value={pref('availability', 'available_from')} onChange={v => setPref('availability', 'available_from', v)} />
            <SelectField label="Notice period" value={pref('availability', 'notice')} onChange={v => setPref('availability', 'notice', v)}
              options={['Immediately', '1 week', '2 weeks', '1 month', '2 months', '3+ months']} />
          </div>
          <SelectField label="Hours per week" value={pref('availability', 'hours')} onChange={v => setPref('availability', 'hours', v)}
            options={['Full-time (40+)', 'Full-time (30-40)', 'Part-time (20-30)', 'Part-time (under 20)', 'Flexible']} />
          <Divider />
          <div className="space-y-4">
            <Toggle label="Open to contract or freelance work" checked={pref('availability', 'open_contract', false)} onChange={v => setPref('availability', 'open_contract', v)} />
            <Toggle label="Open to short-term projects" checked={pref('availability', 'open_short_term', false)} onChange={v => setPref('availability', 'open_short_term', v)} />
            <Toggle label="Currently actively looking" hint="Turn this off to pause new job matches."
              checked={pref('availability', 'actively_looking', false)} onChange={v => setPref('availability', 'actively_looking', v)} />
          </div>
          <SaveBar saving={saving} onSave={() => savePrefs('availability')} />
        </div>
      )}

      {/* ── Work preferences ──────────────────────────────────────────── */}
      {activeTab === 'preferences' && (
        <div className="max-w-2xl bg-white border border-slate-200 rounded-2xl p-6 space-y-6">
          <p className="text-sm text-slate-500">What kind of work you actually want. We use this to rank the roles you see.</p>
          <SelectField label="Work setup" value={pref('preferences', 'setup')} onChange={v => setPref('preferences', 'setup', v)}
            options={['Remote', 'Hybrid', 'On-site', 'No preference']} />
          <TextField label="Roles you want" value={pref('preferences', 'roles')} onChange={v => setPref('preferences', 'roles', v)}
            placeholder="e.g. Backend Engineer, Full Stack Engineer" hint="Comma separated." />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <TextField label="Minimum salary" value={pref('preferences', 'salary_min')} onChange={v => setPref('preferences', 'salary_min', v)} placeholder="e.g. 150000" />
            <SelectField label="Currency" value={pref('preferences', 'currency')} onChange={v => setPref('preferences', 'currency', v)}
              options={['USD', 'EUR', 'GBP', 'PKR', 'AED', 'INR', 'Other']} />
          </div>
          <SelectField label="Company size" value={pref('preferences', 'company_size')} onChange={v => setPref('preferences', 'company_size', v)}
            options={['Startup (1-50)', 'Scale-up (50-500)', 'Mid-size (500-5000)', 'Enterprise (5000+)', 'No preference']} />
          <TextField label="Industries you prefer" value={pref('preferences', 'industries')} onChange={v => setPref('preferences', 'industries', v)}
            placeholder="e.g. Fintech, Healthcare, AI" hint="Optional. Comma separated." />
          <SaveBar saving={saving} onSave={() => savePrefs('preferences')} />
        </div>
      )}

      {/* ── Communications ────────────────────────────────────────────── */}
      {activeTab === 'communications' && (
        <div className="max-w-2xl bg-white border border-slate-200 rounded-2xl p-6 space-y-6">
          <p className="text-sm text-slate-500">Choose what we email you about. You&apos;ll always get essential messages about interviews you&apos;ve started.</p>
          <div className="space-y-4">
            <Toggle label="New job matches" hint="Roles that fit your skills and preferences."
              checked={pref('communications', 'job_matches', true)} onChange={v => setPref('communications', 'job_matches', v)} />
            <Toggle label="Interview invitations" hint="When a company invites you to interview."
              checked={pref('communications', 'invitations', true)} onChange={v => setPref('communications', 'invitations', v)} />
            <Toggle label="Assessment reminders" hint="Nudges for assessments you haven't finished."
              checked={pref('communications', 'reminders', true)} onChange={v => setPref('communications', 'reminders', v)} />
            <Toggle label="Application status updates" hint="Movement on roles you've applied to."
              checked={pref('communications', 'status_updates', true)} onChange={v => setPref('communications', 'status_updates', v)} />
            <Divider />
            <Toggle label="Product updates and tips" hint="Occasional. No spam."
              checked={pref('communications', 'product_updates', false)} onChange={v => setPref('communications', 'product_updates', v)} />
          </div>
          <SaveBar saving={saving} onSave={() => savePrefs('communications')} />
        </div>
      )}

      {/* ── Account ───────────────────────────────────────────────────── */}
      {activeTab === 'account' && (
        <div className="max-w-2xl space-y-6">
          <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-5">
            <div>
              <Label>Email</Label>
              <p className="text-sm text-slate-700 border border-slate-200 rounded-xl px-4 py-2.5 bg-slate-50">{user?.email}</p>
            </div>
            <div>
              <Label>Account type</Label>
              <p className="text-sm text-slate-700 border border-slate-200 rounded-xl px-4 py-2.5 bg-slate-50 capitalize">
                {(profile?.account_type || 'candidate').replace(/_/g, ' ')}
              </p>
            </div>
            <div>
              <Label>Resume on file</Label>
              <p className="text-sm text-slate-700 border border-slate-200 rounded-xl px-4 py-2.5 bg-slate-50">
                {profile?.has_resume ? (profile?.resume_filename || 'Yes') : 'None uploaded yet'}
              </p>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl p-6">
            <p className="text-sm font-semibold text-slate-900 mb-1">Sign out</p>
            <p className="text-xs text-slate-500 mb-4">You&apos;ll be returned to the home page.</p>
            <button
              onClick={async () => {
                const supabase = getSupabaseBrowser()
                await supabase.auth.signOut()
                router.push('/'); router.refresh()
              }}
              className="px-5 py-2.5 text-sm font-semibold border border-slate-300 text-slate-700 rounded-xl hover:bg-slate-50 transition">
              Sign out
            </button>
          </div>

          <div className="bg-white border border-red-200 rounded-2xl p-6">
            <p className="text-sm font-semibold text-red-700 mb-1">Delete account</p>
            <p className="text-xs text-slate-500">
              Permanently removes your profile, resume and interview history. This can&apos;t be undone, so we handle it manually:
              email <span className="font-medium text-slate-700">support@jobstream.ai</span> from this address and we&apos;ll confirm before deleting anything.
            </p>
          </div>
        </div>
      )}
        </div>
      </div>
    </div>
  )
}
