'use client'

import { useEffect, useState } from 'react'

const INDUSTRIES = [
  '', 'Software / SaaS', 'AI / ML', 'E-commerce', 'Fintech', 'Healthcare',
  'Education', 'Media / Entertainment', 'Marketing / Advertising', 'Consulting',
  'Legal', 'Manufacturing', 'Logistics', 'Real Estate', 'Other',
]

export default function CompanySettingsPage() {
  const [form, setForm] = useState({ company_name: '', website: '', industry: '', description: '', logo_url: '' })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    fetch('/api/company-profile', { cache: 'no-store' })
      .then(async (r) => {
        if (!r.ok) throw new Error('Failed to load')
        const d = await r.json()
        if (d.company) setForm({
          company_name: d.company.company_name || '',
          website: d.company.website || '',
          industry: d.company.industry || '',
          description: d.company.description || '',
          logo_url: d.company.logo_url || '',
        })
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  async function save(e) {
    e.preventDefault()
    setSaving(true)
    setError('')
    setSuccess('')
    try {
      const res = await fetch('/api/company-profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        throw new Error(d.error || 'Save failed')
      }
      setSuccess('Saved.')
    } catch (e) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="px-8 py-10 text-slate-500">Loading…</div>

  return (
    <div className="px-8 py-10 max-w-3xl">
      <div className="mb-10">
        <p className="text-[10px] font-black uppercase tracking-[0.4em] text-indigo-400 mb-2">Settings</p>
        <h1 className="text-3xl md:text-4xl font-black text-white">Company profile</h1>
      </div>

      {error && <div className="mb-6 p-4 rounded-2xl border border-red-800 bg-red-950/40 text-red-400 text-sm">{error}</div>}
      {success && <div className="mb-6 p-4 rounded-2xl border border-emerald-800 bg-emerald-950/40 text-emerald-400 text-sm">{success}</div>}

      <form onSubmit={save} className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-5">
        <div className="grid md:grid-cols-2 gap-4">
          <label className="block">
            <span className="text-xs font-black uppercase tracking-[0.3em] text-slate-300">Company Name *</span>
            <input
              type="text"
              required
              value={form.company_name}
              onChange={(e) => setForm({ ...form, company_name: e.target.value })}
              className="mt-2 w-full px-5 py-3 rounded-xl border border-slate-700 focus:border-indigo-500 outline-none transition"
            />
          </label>
          <label className="block">
            <span className="text-xs font-black uppercase tracking-[0.3em] text-slate-300">Industry</span>
            <select
              value={form.industry}
              onChange={(e) => setForm({ ...form, industry: e.target.value })}
              className="mt-2 w-full px-5 py-3 rounded-xl border border-slate-700 focus:border-indigo-500 outline-none transition"
            >
              {INDUSTRIES.map((i) => <option key={i} value={i}>{i || 'Select…'}</option>)}
            </select>
          </label>
        </div>
        <label className="block">
          <span className="text-xs font-black uppercase tracking-[0.3em] text-slate-300">Website</span>
          <input
            type="url"
            value={form.website}
            onChange={(e) => setForm({ ...form, website: e.target.value })}
            placeholder="https://acme.com"
            className="mt-2 w-full px-5 py-3 rounded-xl border border-slate-700 focus:border-indigo-500 outline-none transition"
          />
        </label>
        <label className="block">
          <span className="text-xs font-black uppercase tracking-[0.3em] text-slate-300">Logo URL</span>
          <input
            type="url"
            value={form.logo_url}
            onChange={(e) => setForm({ ...form, logo_url: e.target.value })}
            placeholder="https://acme.com/logo.png"
            className="mt-2 w-full px-5 py-3 rounded-xl border border-slate-700 focus:border-indigo-500 outline-none transition"
          />
        </label>
        <label className="block">
          <span className="text-xs font-black uppercase tracking-[0.3em] text-slate-300">Description</span>
          <textarea
            rows={3}
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            className="mt-2 w-full px-5 py-3 rounded-xl border border-slate-700 focus:border-indigo-500 outline-none transition resize-y"
          />
        </label>
        <button
          type="submit"
          disabled={saving}
          className="text-xs font-black uppercase tracking-widest px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-500/30 transition disabled:opacity-60 self-start"
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
      </form>
    </div>
  )
}
