'use client'

import { useState } from 'react'
import Link from 'next/link'

function fitColor(score) {
  if (score == null) return 'text-muted'
  if (score >= 80) return 'text-emerald-600'
  if (score >= 60) return 'text-indigo-600'
  if (score >= 40) return 'text-amber-600'
  return 'text-red-600'
}

// Client child: search + list only. Data is fetched on the SERVER (page.js) and
// passed in, so the list renders immediately on navigation (no client fetch
// waterfall / "Loading…" flash).
export default function CandidatePoolList({ candidates = [] }) {
  const [q, setQ] = useState('')

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
          <Link href="/company" className="text-xs font-bold text-brand hover:text-indigo-500">
            ← Back to dashboard
          </Link>
          <span className="text-xs font-bold text-muted">
            {filtered.length} candidate{filtered.length === 1 ? '' : 's'}
          </span>
        </div>

        <div className="mb-8">
          <span className="inline-block px-4 py-1.5 rounded-full bg-indigo-50 border border-indigo-200 text-brand font-bold text-xs mb-4">
            Talent Pool
          </span>
          <h1 className="text-3xl md:text-5xl font-bold tracking-tight text-ink">
            Browse <span className="text-brand">Candidates</span>
          </h1>
          <p className="text-muted mt-3">
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

        {filtered.length === 0 ? (
          <p className="text-muted text-sm text-center py-10">
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
                className="bg-white border border-line hover:border-indigo-300 rounded-[1.5rem] p-5 transition-all flex items-center justify-between gap-6 group shadow-sm"
              >
                <div className="flex items-center gap-4 min-w-0">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-indigo-500 to-indigo-700 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                    {(c.full_name || '?').split(/\s+/).map(s => s[0]).join('').slice(0, 2).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <h2 className="font-bold text-ink truncate group-hover:text-brand transition-colors">
                      {c.full_name || '(no name)'}
                    </h2>
                    <p className="text-muted text-xs mt-0.5 truncate">
                      📄 {c.resume_filename || 'resume.pdf'} · {c.resume_pages || '?'} pages ·{' '}
                      {c.resume_uploaded_at ? new Date(c.resume_uploaded_at).toLocaleDateString() : '—'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-8 text-right flex-shrink-0">
                  <div>
                    <p className="text-xs font-bold text-muted">Interviews</p>
                    <p className="text-xl font-bold text-ink">{c.interview_count || 0}</p>
                  </div>
                  <div>
                    <p className="text-xs font-bold text-muted">Top fit</p>
                    <p className={`text-xl font-bold ${fitColor(c.top_fit_score)}`}>
                      {c.top_fit_score != null ? `${c.top_fit_score}%` : '—'}
                    </p>
                  </div>
                  <span className="text-muted group-hover:text-brand transition-colors">→</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
