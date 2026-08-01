'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'

function decisionBadge(decision) {
  if (decision === 'hire') return { label: 'Hired', cls: 'bg-emerald-50 text-emerald-600 border-emerald-200' }
  if (decision === 'reject') return { label: 'Rejected', cls: 'bg-red-50 text-red-600 border-red-200' }
  return { label: 'Pending', cls: 'bg-slate-100 text-slate-700 border-slate-300' }
}

export default function CandidateDetailPage() {
  const { id } = useParams()
  const [data, setData] = useState({ candidate: null, interviews: [] })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch(`/api/candidates-pool/${id}`, { cache: 'no-store' })
      .then(async (r) => {
        if (!r.ok) {
          const d = await r.json().catch(() => ({}))
          throw new Error(d.error || `Failed (${r.status})`)
        }
        return r.json()
      })
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [id])

  if (loading) return <div className="min-h-screen pt-32 text-center text-slate-400">Loading…</div>
  if (error) {
    return (
      <div className="min-h-screen pt-32 px-4 text-center">
        <p className="text-red-600 mb-4">{error}</p>
        <Link href="/company/candidates" className="text-indigo-600 underline">← Back to candidates</Link>
      </div>
    )
  }
  const { candidate, interviews } = data
  if (!candidate) return <div className="min-h-screen pt-32 text-center text-slate-400">Not found</div>

  return (
    <div className="min-h-screen pt-32 pb-24 px-4">
      <div className="container mx-auto max-w-4xl">
        <Link href="/company/candidates" className="text-xs font-black uppercase tracking-widest text-indigo-600 hover:text-indigo-500">
          ← All candidates
        </Link>

        <div className="mt-6 mb-10 flex items-start gap-6">
          <div className="w-20 h-20 rounded-full bg-gradient-to-br from-indigo-500 to-indigo-700 flex items-center justify-center text-white font-black text-2xl flex-shrink-0">
            {(candidate.full_name || '?').split(/\s+/).map(s => s[0]).join('').slice(0, 2).toUpperCase()}
          </div>
          <div className="flex-1">
            <h1 className="text-3xl md:text-4xl font-black text-slate-900">
              {candidate.full_name || '(no name)'}
            </h1>
            <p className="text-slate-400 text-sm mt-1">
              {candidate.resume_filename} · {candidate.resume_pages} pages · uploaded{' '}
              {candidate.resume_uploaded_at ? new Date(candidate.resume_uploaded_at).toLocaleDateString() : '—'}
            </p>
          </div>
        </div>

        {/* Resume text */}
        <div className="bg-white border border-slate-200 rounded-[2rem] p-6 md:p-8 mb-6 shadow-sm">
          <h2 className="text-xs font-black uppercase tracking-[0.3em] text-slate-500 mb-4">Resume</h2>
          <pre className="whitespace-pre-wrap text-slate-700 text-sm leading-relaxed font-sans">
            {candidate.resume_text || '(empty)'}
          </pre>
        </div>

        {/* Interview history (only for THIS company's jobs) */}
        <div className="bg-white border border-slate-200 rounded-[2rem] p-6 md:p-8 shadow-sm">
          <h2 className="text-xs font-black uppercase tracking-[0.3em] text-slate-500 mb-4">
            Interview history with your company ({interviews.length})
          </h2>
          {interviews.length === 0 ? (
            <p className="text-slate-400 text-sm">This candidate hasn't interviewed for any of your jobs yet.</p>
          ) : (
            <div className="space-y-3">
              {interviews.map((iv) => {
                const badge = decisionBadge(iv.decision)
                return (
                  <Link
                    key={iv.id}
                    href={`/company/jobs/${iv.job_id}`}
                    className="block bg-slate-50 border border-slate-200 hover:border-indigo-300 rounded-2xl p-4 transition-all"
                  >
                    <div className="flex items-center justify-between gap-4 mb-2">
                      <p className="font-black text-slate-900 text-sm">{iv.job_title}</p>
                      <span className={`text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full border ${badge.cls}`}>
                        {badge.label}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <p className="text-slate-400">
                        {new Date(iv.created_at).toLocaleString()}
                      </p>
                      {iv.job_fit_score != null && (
                        <p className="text-indigo-600 font-black">{iv.job_fit_score}% fit</p>
                      )}
                    </div>
                  </Link>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
