'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function CompanyJobsPage() {
  const router = useRouter()
  const [jobs, setJobs] = useState([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const EMPTY_FORM = {
    title: '', role: '', description: '',
    requiredAssessments: [],
    requiresAiInterview: true,
    // The written software test for this job (frameworks/swe-assessment-design.md).
    writtenTest: { enabled: true, track: 'backend', level: 'L3', languages: ['javascript', 'typescript', 'python'], reasoning: true },
  }
  const [form, setForm] = useState(EMPTY_FORM)
  const [error, setError] = useState('')
  const [suggestion, setSuggestion] = useState(null)
  const [suggesting, setSuggesting] = useState(false)

  // Other assessment families, not built yet.
  const ASSESSMENT_OPTIONS = [
    { code: 'pm-consumer', label: 'Product Management', available: false },
    { code: 'sales-ae', label: 'Sales (AE)', available: false },
  ]
  // Tests by industry. Families not built yet use the General workplace test.
  const TRACK_GROUPS = [
    { label: 'Software engineering', tracks: [
      { key: 'backend', label: 'Backend', available: true },
      { key: 'frontend', label: 'Frontend', available: true },
      { key: 'fullstack', label: 'Full stack', available: true },
      { key: 'mobile', label: 'Mobile', available: false },
      { key: 'qa', label: 'QA / Test automation', available: false },
      { key: 'devops', label: 'DevOps / Cloud', available: false },
    ] },
    { label: 'Customer service and call centre', tracks: [
      { key: 'customer_service', label: 'Customer service (calls, chat, email)', available: true },
      { key: 'telesales', label: 'Telesales', available: false },
      { key: 'collections', label: 'Collections', available: false },
    ] },
    { label: 'English language', tracks: [
      { key: 'english', label: 'English test only (Screener, about 18 min)', available: true },
    ] },
    { label: 'Any other job', tracks: [
      { key: 'general', label: 'General workplace test', available: true },
    ] },
  ]
  const SWE_LEVELS = [
    { key: 'L2', label: 'Junior (0-2 years)' },
    { key: 'L3', label: 'Mid (2-5 years)' },
    { key: 'L4', label: 'Senior (5+ years)' },
    { key: 'L5', label: 'Lead' },
  ]
  const LEVELS_BY_TRACK = {
    general: [{ key: 'staff', label: 'Staff' }, { key: 'manager', label: 'Manager' }],
    customer_service: [{ key: 'agent', label: 'Agent' }],
    english: [{ key: 'screener', label: 'Screener' }],
  }
  const CEFR_OPTIONS = [
    { key: 'B1', label: 'B1 (chat, email, back office)' },
    { key: 'B2', label: 'B2 (phone agents)' },
    { key: 'C1', label: 'C1 (international or premium accounts)' },
  ]
  const levelsFor = (track) => LEVELS_BY_TRACK[track] || SWE_LEVELS
  const isSwe = (track) => !LEVELS_BY_TRACK[track]
  const LANGUAGE_OPTIONS = [
    { key: 'javascript', label: 'JavaScript' },
    { key: 'typescript', label: 'TypeScript' },
    { key: 'python', label: 'Python' },
  ]
  // Frontend work is JavaScript/TypeScript only; non-software tests have no coding.
  const TRACK_LANGUAGES = { frontend: ['javascript', 'typescript'] }
  const languagesFor = (track) => (isSwe(track) ? (TRACK_LANGUAGES[track] || LANGUAGE_OPTIONS.map((l) => l.key)) : [])
  const setTest = (patch) => setForm((f) => {
    const next = { ...f.writtenTest, ...patch }
    if (!levelsFor(next.track).some((l) => l.key === next.level)) next.level = levelsFor(next.track)[isSwe(next.track) ? 1 : 0].key
    const allowed = languagesFor(next.track)
    next.languages = (next.languages || []).filter((l) => allowed.includes(l))
    if (next.languages.length === 0) next.languages = [...allowed]
    return { ...f, writtenTest: next }
  })

  async function suggestTest() {
    setSuggesting(true)
    try {
      const res = await fetch('/api/jobs/suggest-assessment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: form.title, role: form.role, description: form.description }),
      })
      const s = await res.json()
      if (!res.ok) throw new Error(s.error || 'Could not suggest')
      setTest({ enabled: true, track: s.track, level: s.level, languages: s.languages, typingProfile: s.options?.typingProfile || 'voice',
        englishAddOn: Boolean(s.english), englishLevel: s.english?.requiredLevel || 'B2' })
      setSuggestion(s)
    } catch (e) {
      setError(e.message)
    } finally {
      setSuggesting(false)
    }
  }

  function toggleAssessment(code) {
    setForm((f) => ({
      ...f,
      requiredAssessments: f.requiredAssessments.includes(code)
        ? f.requiredAssessments.filter((c) => c !== code)
        : [...f.requiredAssessments, code],
    }))
  }

  async function loadJobs() {
    setLoading(true)
    try {
      const res = await fetch('/api/jobs', { cache: 'no-store' })
      if (res.status === 401) { router.push('/login/company'); return }
      if (res.status === 403) { setError('This page is for company accounts.'); return }
      const data = await res.json()
      setJobs(data.jobs || [])
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadJobs() }, [])

  async function createJob(e) {
    e.preventDefault()
    if (!form.title.trim() || !form.role.trim() || !form.description.trim()) return
    setCreating(true)
    setError('')
    try {
      const res = await fetch('/api/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: form.title, role: form.role, description: form.description,
          requiredAssessments: form.requiredAssessments,
          requiresAiInterview: form.requiresAiInterview,
          assessmentConfig: form.writtenTest.enabled ? {
            track: form.writtenTest.track,
            level: form.writtenTest.level,
            languages: form.writtenTest.languages,
            disabledSections: form.writtenTest.level === 'L2' && !form.writtenTest.reasoning ? ['reasoning'] : [],
            options: form.writtenTest.track === 'customer_service' ? { typingProfile: form.writtenTest.typingProfile || 'voice' }
              : form.writtenTest.track === 'english' ? { requiredLevel: form.writtenTest.englishLevel || 'B2' } : {},
            english: form.writtenTest.track !== 'english' && form.writtenTest.englishAddOn ? { requiredLevel: form.writtenTest.englishLevel || 'B2' } : null,
          } : { enabled: false },
        }),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        throw new Error(d.error || `Failed (${res.status})`)
      }
      setForm(EMPTY_FORM)
      setSuggestion(null)
      setShowForm(false)
      await loadJobs()
    } catch (e) {
      setError(e.message)
    } finally {
      setCreating(false)
    }
  }

  function shareLink(slug) {
    if (typeof window === 'undefined') return ''
    return `${window.location.origin}/interview/${slug}`
  }

  return (
    <div className="px-8 py-10">
      <div className="flex items-end justify-between mb-10">
        <div>
          <p className="text-xs font-bold text-brand mb-2">Jobs</p>
          <h1 className="text-3xl md:text-4xl font-bold text-ink">Your open positions</h1>
        </div>
        <button
          onClick={() => setShowForm((s) => !s)}
          className="text-xs font-bold px-5 py-3 rounded-xl bg-brand hover:bg-brand-dark text-white shadow-lg shadow-indigo-500/30 transition"
        >
          {showForm ? 'Cancel' : '+ Create Job'}
        </button>
      </div>

      {error && (
        <div className="mb-6 p-4 rounded-2xl border border-red-200 bg-red-50 text-red-600 text-sm">{error}</div>
      )}

      {showForm && (
        <form onSubmit={createJob} className="bg-white border border-line rounded-2xl p-6 mb-8 shadow-sm">
          <h2 className="text-xs font-bold text-muted mb-5">Create New Job</h2>
          <div className="grid gap-4">
            <div className="grid md:grid-cols-2 gap-4">
              <label className="block">
                <span className="text-xs font-bold text-body">Job Title</span>
                <input
                  type="text"
                  required
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="Senior Frontend Engineer (Remote)"
                  className="mt-2 w-full px-5 py-3 rounded-xl border border-slate-300 focus:border-indigo-500 outline-none transition"
                />
              </label>
              <label className="block">
                <span className="text-xs font-bold text-body">Role (short)</span>
                <input
                  type="text"
                  required
                  value={form.role}
                  onChange={(e) => setForm({ ...form, role: e.target.value })}
                  placeholder="Senior Frontend Engineer"
                  className="mt-2 w-full px-5 py-3 rounded-xl border border-slate-300 focus:border-indigo-500 outline-none transition"
                />
              </label>
            </div>
            <label className="block">
              <span className="text-xs font-bold text-body">Job Description</span>
              <textarea
                required
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Paste the full job description. The richer the detail, the more targeted the interview questions and the better the fit scoring."
                rows={6}
                className="mt-2 w-full px-5 py-3 rounded-xl border border-slate-300 focus:border-indigo-500 outline-none transition resize-y"
              />
            </label>

            {/* Application requirements */}
            <div className="rounded-xl border border-line bg-slate-50 p-5">
              <p className="text-xs font-bold text-muted mb-1">Application Requirements</p>
              <p className="text-xs text-muted mb-4">What candidates must complete before they can apply.</p>

              <p className="text-xs font-bold text-muted mb-2">Written skills test</p>
              <div className={`rounded-xl border p-4 mb-5 ${form.writtenTest.enabled ? 'border-indigo-500 bg-indigo-50/40' : 'border-slate-300'}`}>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.writtenTest.enabled}
                    onChange={(e) => setTest({ enabled: e.target.checked })}
                    className="w-4 h-4 accent-indigo-500"
                  />
                  <span className="text-sm text-body font-medium flex-1">Skills test for this job (every job gets one; pick the closest industry)</span>
                  <button
                    type="button"
                    onClick={suggestTest}
                    disabled={suggesting || !form.description.trim()}
                    className="text-xs font-bold px-3 py-2 rounded-lg border border-indigo-300 text-indigo-700 hover:bg-indigo-100 disabled:opacity-50"
                  >
                    {suggesting ? 'Reading…' : 'Suggest from description'}
                  </button>
                </label>
                {form.writtenTest.enabled && (
                  <div className="grid md:grid-cols-2 gap-3 mt-4">
                    <label className="grid gap-1 text-xs">
                      <span className="font-bold text-muted">Test</span>
                      <select value={form.writtenTest.track} onChange={(e) => setTest({ track: e.target.value })} className="px-3 py-2 rounded-lg border border-slate-300 bg-white text-sm">
                        {TRACK_GROUPS.map((g) => (
                          <optgroup key={g.label} label={g.label}>
                            {g.tracks.map((t) => <option key={t.key} value={t.key} disabled={!t.available}>{t.label}{t.available ? '' : ' (coming soon)'}</option>)}
                          </optgroup>
                        ))}
                      </select>
                    </label>
                    <label className="grid gap-1 text-xs">
                      <span className="font-bold text-muted">Level</span>
                      <select value={form.writtenTest.level} onChange={(e) => setTest({ level: e.target.value })} className="px-3 py-2 rounded-lg border border-slate-300 bg-white text-sm">
                        {levelsFor(form.writtenTest.track).map((l) => <option key={l.key} value={l.key}>{l.label}</option>)}
                      </select>
                    </label>
                    {form.writtenTest.track === 'customer_service' && (
                      <label className="md:col-span-2 grid gap-1 text-xs">
                        <span className="font-bold text-muted">Main channel (sets the typing pass mark)</span>
                        <select value={form.writtenTest.typingProfile || 'voice'} onChange={(e) => setTest({ typingProfile: e.target.value })} className="px-3 py-2 rounded-lg border border-slate-300 bg-white text-sm">
                          <option value="voice">Phone calls (25 words a minute, 92% accuracy)</option>
                          <option value="chat">Chat and email (35 words a minute, 95% accuracy)</option>
                        </select>
                      </label>
                    )}
                    <div className="md:col-span-2 grid sm:grid-cols-2 gap-3 items-end">
                      {form.writtenTest.track !== 'english' && (
                        <label className="flex items-center gap-2 text-xs text-body">
                          <input type="checkbox" checked={Boolean(form.writtenTest.englishAddOn)} onChange={(e) => setTest({ englishAddOn: e.target.checked })} className="accent-indigo-500" />
                          Also require the English test (speaking, listening, reading; about 18 min)
                        </label>
                      )}
                      {(form.writtenTest.track === 'english' || form.writtenTest.englishAddOn) && (
                        <label className="grid gap-1 text-xs">
                          <span className="font-bold text-muted">Required English level</span>
                          <select value={form.writtenTest.englishLevel || 'B2'} onChange={(e) => setTest({ englishLevel: e.target.value })} className="px-3 py-2 rounded-lg border border-slate-300 bg-white text-sm">
                            {CEFR_OPTIONS.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
                          </select>
                        </label>
                      )}
                    </div>
                    {isSwe(form.writtenTest.track) && (
                    <div className="md:col-span-2 grid gap-1 text-xs">
                      <span className="font-bold text-muted">Candidates may code in</span>
                      <div className="flex flex-wrap gap-2">
                        {LANGUAGE_OPTIONS.filter((l) => languagesFor(form.writtenTest.track).includes(l.key)).map((l) => {
                          const on = form.writtenTest.languages.includes(l.key)
                          return (
                            <button
                              key={l.key}
                              type="button"
                              onClick={() => setTest({ languages: on ? form.writtenTest.languages.filter((x) => x !== l.key) : [...form.writtenTest.languages, l.key] })}
                              className={`px-3 py-1.5 rounded-full border text-xs font-bold ${on ? 'border-indigo-500 bg-brand text-white' : 'border-slate-300 text-body'}`}
                            >
                              {l.label}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                    )}
                    {form.writtenTest.level === 'L2' && (
                      <label className="md:col-span-2 flex items-center gap-2 text-xs text-body">
                        <input type="checkbox" checked={form.writtenTest.reasoning} onChange={(e) => setTest({ reasoning: e.target.checked })} className="accent-indigo-500" />
                        Include the short reasoning section (Junior only)
                      </label>
                    )}
                    {suggestion && (
                      <p className="md:col-span-2 text-xs text-muted">
                        {suggestion.note && <span className="block font-bold text-amber-700 mb-1">{suggestion.note}</span>}
                        Suggested because {suggestion.reasons.join('; ')}. Change anything that is not right.
                      </p>
                    )}
                  </div>
                )}
              </div>

              <p className="text-xs font-bold text-muted mb-2">Other assessments</p>
              <div className="grid gap-2 mb-5">
                {ASSESSMENT_OPTIONS.map((opt) => (
                  <label
                    key={opt.code}
                    className={`flex items-center gap-3 px-4 py-3 rounded-xl border cursor-pointer transition ${ form.requiredAssessments.includes(opt.code) ? 'border-indigo-500 bg-indigo-50' : 'border-slate-300 hover:border-slate-400' } ${!opt.available ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    <input
                      type="checkbox"
                      disabled={!opt.available}
                      checked={form.requiredAssessments.includes(opt.code)}
                      onChange={() => opt.available && toggleAssessment(opt.code)}
                      className="w-4 h-4 accent-indigo-500"
                    />
                    <span className="text-sm text-body font-medium flex-1">{opt.label}</span>
                    {!opt.available && (
                      <span className="text-xs font-bold text-muted">Coming soon</span>
                    )}
                  </label>
                ))}
              </div>

              <label className="flex items-center gap-3 px-4 py-3 rounded-xl border border-slate-300 cursor-pointer hover:border-slate-400 transition">
                <input
                  type="checkbox"
                  checked={form.requiresAiInterview}
                  onChange={(e) => setForm({ ...form, requiresAiInterview: e.target.checked })}
                  className="w-4 h-4 accent-indigo-500"
                />
                <span className="text-sm text-body font-medium flex-1">AI Interview with Iris</span>
                <span className="text-xs font-bold text-brand">Recommended</span>
              </label>
            </div>

            <button
              type="submit"
              disabled={creating}
              className="text-xs font-bold px-6 py-3 rounded-xl bg-brand hover:bg-brand-dark text-white shadow-lg shadow-indigo-500/30 transition disabled:opacity-60 self-start"
            >
              {creating ? 'Creating…' : 'Create Job'}
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <p className="text-muted text-sm text-center py-10">Loading…</p>
      ) : jobs.length === 0 ? (
        <div className="bg-white border border-line rounded-2xl p-10 text-center shadow-sm">
          <p className="text-muted text-sm mb-4">No jobs yet. Create your first one to start receiving AI-screened candidates.</p>
          {!showForm && (
            <button
              onClick={() => setShowForm(true)}
              className="text-xs font-bold px-5 py-3 rounded-xl bg-brand hover:bg-brand-dark text-white"
            >
              + Create Job
            </button>
          )}
        </div>
      ) : (
        <div className="grid gap-3">
          {jobs.map((j) => (
            <div key={j.id} className="bg-white border border-line rounded-2xl p-5 hover:border-slate-300 transition shadow-sm">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                  <h2 className="text-lg font-bold text-ink">{j.title}</h2>
                  <p className="text-brand text-xs font-bold mt-1">{j.role}</p>
                </div>
                <div className="flex items-center gap-6 text-sm">
                  <div className="text-center">
                    <p className="text-xs font-bold text-muted">Candidates</p>
                    <p className="text-lg font-bold text-ink">{j.candidate_count || 0}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs font-bold text-muted">Top fit</p>
                    <p className="text-lg font-bold text-emerald-700">{j.top_fit != null ? `${j.top_fit}%` : '—'}</p>
                  </div>
                </div>
              </div>
              <div className="mt-4 pt-4 border-t border-line flex flex-col md:flex-row gap-3 md:items-center">
                <button
                  onClick={() => navigator.clipboard.writeText(shareLink(j.slug))}
                  className="text-xs font-bold px-4 py-2 rounded-full bg-slate-100 hover:bg-slate-200 text-body transition"
                >
                  Copy Interview Link
                </button>
                <code className="text-xs text-muted truncate md:flex-1">{shareLink(j.slug)}</code>
                <Link
                  href={`/company/jobs/${j.id}`}
                  className="text-xs font-bold px-4 py-2 rounded-full bg-brand hover:bg-brand-dark text-white transition"
                >
                  View Candidates →
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
