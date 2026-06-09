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
  const [form, setForm] = useState({ title: '', role: '', description: '' })
  const [error, setError] = useState('')

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
        body: JSON.stringify(form),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        throw new Error(d.error || `Failed (${res.status})`)
      }
      setForm({ title: '', role: '', description: '' })
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
          <p className="text-[10px] font-black uppercase tracking-[0.4em] text-indigo-400 mb-2">Jobs</p>
          <h1 className="text-3xl md:text-4xl font-black text-white">Your open positions</h1>
        </div>
        <button
          onClick={() => setShowForm((s) => !s)}
          className="text-xs font-black uppercase tracking-widest px-5 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-500/30 transition"
        >
          {showForm ? 'Cancel' : '+ Create Job'}
        </button>
      </div>

      {error && (
        <div className="mb-6 p-4 rounded-2xl border border-red-800 bg-red-950/40 text-red-400 text-sm">{error}</div>
      )}

      {showForm && (
        <form onSubmit={createJob} className="bg-slate-900 border border-slate-800 rounded-2xl p-6 mb-8">
          <h2 className="text-xs font-black uppercase tracking-[0.4em] text-slate-400 mb-5">Create New Job</h2>
          <div className="grid gap-4">
            <div className="grid md:grid-cols-2 gap-4">
              <label className="block">
                <span className="text-xs font-black uppercase tracking-[0.3em] text-slate-300">Job Title</span>
                <input
                  type="text"
                  required
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="Senior Frontend Engineer (Remote)"
                  className="mt-2 w-full px-5 py-3 rounded-xl border border-slate-700 focus:border-indigo-500 outline-none transition"
                />
              </label>
              <label className="block">
                <span className="text-xs font-black uppercase tracking-[0.3em] text-slate-300">Role (short)</span>
                <input
                  type="text"
                  required
                  value={form.role}
                  onChange={(e) => setForm({ ...form, role: e.target.value })}
                  placeholder="Senior Frontend Engineer"
                  className="mt-2 w-full px-5 py-3 rounded-xl border border-slate-700 focus:border-indigo-500 outline-none transition"
                />
              </label>
            </div>
            <label className="block">
              <span className="text-xs font-black uppercase tracking-[0.3em] text-slate-300">Job Description</span>
              <textarea
                required
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Paste the full job description. The richer the detail, the more targeted the interview questions and the better the fit scoring."
                rows={6}
                className="mt-2 w-full px-5 py-3 rounded-xl border border-slate-700 focus:border-indigo-500 outline-none transition resize-y"
              />
            </label>
            <button
              type="submit"
              disabled={creating}
              className="text-xs font-black uppercase tracking-widest px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-500/30 transition disabled:opacity-60 self-start"
            >
              {creating ? 'Creating…' : 'Create Job'}
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <p className="text-slate-500 text-sm text-center py-10">Loading…</p>
      ) : jobs.length === 0 ? (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-10 text-center">
          <p className="text-slate-400 text-sm mb-4">No jobs yet. Create your first one to start receiving AI-screened candidates.</p>
          {!showForm && (
            <button
              onClick={() => setShowForm(true)}
              className="text-xs font-black uppercase tracking-widest px-5 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white"
            >
              + Create Job
            </button>
          )}
        </div>
      ) : (
        <div className="grid gap-3">
          {jobs.map((j) => (
            <div key={j.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-5 hover:border-slate-700 transition">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                  <h3 className="text-lg font-black text-white">{j.title}</h3>
                  <p className="text-indigo-400 text-[10px] font-black uppercase tracking-widest mt-1">{j.role}</p>
                </div>
                <div className="flex items-center gap-6 text-sm">
                  <div className="text-center">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Candidates</p>
                    <p className="text-lg font-black text-white">{j.candidate_count || 0}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Top fit</p>
                    <p className="text-lg font-black text-emerald-400">{j.top_fit != null ? `${j.top_fit}%` : '—'}</p>
                  </div>
                </div>
              </div>
              <div className="mt-4 pt-4 border-t border-slate-800 flex flex-col md:flex-row gap-3 md:items-center">
                <button
                  onClick={() => navigator.clipboard.writeText(shareLink(j.slug))}
                  className="text-[10px] font-black uppercase tracking-widest px-4 py-2 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-200 transition"
                >
                  Copy Interview Link
                </button>
                <code className="text-[10px] text-slate-500 truncate md:flex-1">{shareLink(j.slug)}</code>
                <Link
                  href={`/company/jobs/${j.id}`}
                  className="text-[10px] font-black uppercase tracking-widest px-4 py-2 rounded-full bg-indigo-600 hover:bg-indigo-500 text-white transition"
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
