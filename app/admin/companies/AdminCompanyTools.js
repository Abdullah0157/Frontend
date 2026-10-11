'use client'

import { useEffect, useState } from 'react'

// Admin tools for invite-only companies: the "Contact us" enquiries, and
// giving a client's account company access.
export default function AdminCompanyTools() {
  const [enquiries, setEnquiries] = useState(null)
  const [form, setForm] = useState({ email: '', companyName: '' })
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState(null)

  const load = () => fetch('/api/admin/enquiries', { cache: 'no-store' })
    .then((r) => (r.ok ? r.json() : { enquiries: [] })).then((d) => setEnquiries(d.enquiries || [])).catch(() => setEnquiries([]))
  useEffect(() => { load() }, [])

  async function grant(e) {
    e.preventDefault()
    setBusy(true); setNote(null)
    try {
      const res = await fetch('/api/admin/company-access', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(form) })
      const d = await res.json().catch(() => ({}))
      if (res.ok) { setNote({ ok: true, text: `${form.email} now has company access as ${form.companyName}. Refresh to see it in the list.` }); setForm({ email: '', companyName: '' }) }
      else setNote({ ok: false, text: d.error || 'Could not give access.' })
    } finally { setBusy(false) }
  }

  async function setStatus(id, status) {
    await fetch('/api/admin/enquiries', { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id, status }) })
    load()
  }

  const fresh = (enquiries || []).filter((q) => q.status === 'new').length
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_1.4fr]">
      <form onSubmit={grant} className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Give company access</h2>
          <p className="text-sm text-slate-500 mt-1">The client first creates a normal account at /signup. Then enter their email here.</p>
        </div>
        <label className="block text-sm">
          <span className="font-medium text-slate-700">Their account email</span>
          <input type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="mt-1.5 w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:border-indigo-500 outline-none" />
        </label>
        <label className="block text-sm">
          <span className="font-medium text-slate-700">Company name</span>
          <input required value={form.companyName} onChange={(e) => setForm({ ...form, companyName: e.target.value })} className="mt-1.5 w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:border-indigo-500 outline-none" />
        </label>
        {note && <p role="status" className={`text-sm ${note.ok ? 'text-emerald-700' : 'text-red-600'}`}>{note.text}</p>}
        <button type="submit" disabled={busy} className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold disabled:opacity-60">
          {busy ? 'Saving…' : 'Give company access'}
        </button>
      </form>

      <div className="bg-white rounded-2xl border border-slate-200 p-6">
        <h2 className="text-lg font-bold text-slate-900">Enquiries {fresh > 0 && <span className="ml-2 text-xs font-bold px-2 py-0.5 rounded-full bg-indigo-600 text-white">{fresh} new</span>}</h2>
        <p className="text-sm text-slate-500 mt-1 mb-4">Messages from the Contact us page.</p>
        {enquiries === null ? <p className="text-sm text-slate-500">Loading…</p> : enquiries.length === 0 ? (
          <p className="text-sm text-slate-500">No enquiries yet.</p>
        ) : (
          <ul className="divide-y divide-slate-100 max-h-[520px] overflow-y-auto" tabIndex={0} aria-label="Enquiries">
            {enquiries.map((q) => (
              <li key={q.id} className="py-4">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="font-semibold text-slate-900">{q.company} <span className="font-normal text-slate-600">· {q.name}</span></p>
                  <span className="text-xs text-slate-500">{new Date(q.created_at).toLocaleString()}</span>
                </div>
                <p className="text-sm text-slate-600 mt-1">
                  <a href={`mailto:${q.email}`} className="text-indigo-700 hover:underline">{q.email}</a>{q.phone ? ` · ${q.phone}` : ''}
                </p>
                <p className="text-sm text-slate-700 mt-2 whitespace-pre-wrap">{q.message}</p>
                <div className="flex gap-2 mt-3">
                  {['new', 'contacted', 'closed'].map((s) => (
                    <button key={s} type="button" onClick={() => setStatus(q.id, s)} aria-pressed={q.status === s}
                      className={`text-xs font-bold px-3 py-1.5 rounded-full border ${q.status === s ? 'bg-slate-900 text-white border-slate-900' : 'border-slate-300 text-slate-600 hover:bg-slate-50'}`}>
                      {s === 'new' ? 'New' : s === 'contacted' ? 'Contacted' : 'Closed'}
                    </button>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
