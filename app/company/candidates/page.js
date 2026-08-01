'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

function fitColor(score) {
  if (score == null) return 'text-slate-400'
  if (score >= 80) return 'text-emerald-600'
  if (score >= 60) return 'text-indigo-600'
  if (score >= 40) return 'text-amber-600'
  return 'text-red-600'
}

export default function CandidatePoolPage() {
  const [candidates, setCandidates] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [q, setQ] = useState('')

  useEffect(() => {
    fetch('/api/candidates-pool', { cache: 'no-store' })
      .then(async (r) => {
        if (!r.ok) {
          const d = await r.json().catch(() => ({}))
          throw new Error(d.error || `Failed (${r.status})`)
        }
        return r.json()
      })
      .then((d) => setCandidates(d.candidates || []))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  const filtered = q
    ? candidates.filter((c) =>
        [c.full_name, c.resume_filename]
          .filter(Boolean)
          .some((s) => s.toLowerCase().includes(q.toLowerCase()))
      )
    : candidates

  return (
    <div className="min-h-screen pt-32 pb-24 px-4">
      <div className="container mx-auto max-w-5xl">
        <div className="flex items-center justify-between mb-8">
          <Link href="/company" className="text-xs font-black uppercase tracking-widest text-indigo-600 hover:text-indigo-500">
            ← Back to dashboard
          </Link>
          <span className="text-xs font-black uppercase tracking-[0.4em] text-slate-500">
            {filtered.length} candidate{filtered.length === 1 ? '' : 's'}
          </span>
        </div>

        <div className="mb-8">
          <span className="inline-block px-4 py-1.5 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-600 font-black text-[10px] uppercase tracking-[0.4em] mb-4">
            Talent Pool
          </span>
          <h1 className="text-3xl md:text-5xl font-black tracking-tight uppercase text-slate-900">
            Browse <span className="text-indigo-600">Candidates</span>
          </h1>
          <p className="text-slate-500 mt-3">
            Every candidate who has signed up and uploaded a resume.
          </p>
        </div>

        <div className="mb-6">
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by name or resume filename…"
            className="w-full px-5 py-4 rounded-2xl border border-slate-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none transition"
          />
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-2xl border border-red-200 bg-red-50 text-red-600 text-sm">{error}</div>
        )}

        {loading ? (
          <p className="text-slate-400 text-sm text-center py-10">Loading…</p>
        ) : filtered.length === 0 ? (
          <p className="text-slate-400 text-sm text-center py-10">
            {candidates.length === 0
              ? 'No candidates have uploaded resumes yet.'
              : 'No matches for that search.'}
          </p>
        ) : (
          <div className="grid gap-3">
            {filtered.map((c) => (
              <Link
                key={c.user_id}
                href={`/company/candidates/${c.user_id}`}
                className="bg-white border border-slate-200 hover:border-indigo-300 rounded-[1.5rem] p-5 transition-all flex items-center justify-between gap-6 group shadow-sm"
              >
                <div className="flex items-center gap-4 min-w-0">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-indigo-500 to-indigo-700 flex items-center justify-center text-white font-black text-sm flex-shrink-0">
                    {(c.full_name || '?').split(/\s+/).map(s => s[0]).join('').slice(0, 2).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-black text-slate-900 truncate group-hover:text-indigo-600 transition-colors">
                      {c.full_name || '(no name)'}
                    </h3>
                    <p className="text-slate-400 text-xs mt-0.5 truncate">
                      📄 {c.resume_filename || 'resume.pdf'} · {c.resume_pages || '?'} pages ·{' '}
                      {c.resume_uploaded_at ? new Date(c.resume_uploaded_at).toLocaleDateString() : '—'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-8 text-right flex-shrink-0">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Interviews</p>
                    <p className="text-xl font-black text-slate-900">{c.interview_count || 0}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Top fit</p>
                    <p className={`text-xl font-black ${fitColor(c.top_fit_score)}`}>
                      {c.top_fit_score != null ? `${c.top_fit_score}%` : '—'}
                    </p>
                  </div>
                  <span className="text-slate-400 group-hover:text-indigo-600 transition-colors">→</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
