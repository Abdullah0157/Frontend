'use client'

import { useState } from 'react'

// A candidate's own job interviews: what went well and what to practise. The
// page sends only that (lib/interview-record.js candidateView); the score and
// the hiring recommendation are for the hiring team.

function relativeTime(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)
  if (mins < 2) return 'just now'
  if (mins < 60) return `${mins} minutes ago`
  if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`
  if (days < 7) return `${days} day${days > 1 ? 's' : ''} ago`
  if (days < 30) return `${Math.floor(days / 7)} week${Math.floor(days / 7) > 1 ? 's' : ''} ago`
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function InterviewCard({ row }) {
  const [open, setOpen] = useState(false)
  const { strengths = [], practise = [] } = row.view || {}
  const panelId = `interview-${row.id}`

  return (
    <div className={`bg-white border rounded-2xl overflow-hidden transition-all ${open ? 'border-indigo-300' : 'border-slate-200 hover:border-indigo-400'}`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={panelId}
        className="w-full flex items-center justify-between gap-4 p-6 text-left"
      >
        <div className="min-w-0 flex-1">
          <p className="text-lg font-bold text-slate-900 truncate">{row.job_title || 'Untitled Job'}</p>
          <p className="text-sm text-slate-500 mt-1">{row.job_role ? `${row.job_role} · ` : ''}{relativeTime(row.created_at)}</p>
        </div>
        <span className="hidden sm:inline-flex text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 whitespace-nowrap">
          Sent to the hiring team
        </span>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"
          aria-hidden="true" className={`text-slate-500 transition-transform duration-200 flex-shrink-0 ${open ? 'rotate-180' : ''}`}>
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {open && (
        <div id={panelId} className="px-6 pb-6 pt-5 bg-slate-50/50 border-t border-slate-100 space-y-5">
          {strengths.length > 0 && (
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.15em] text-emerald-700 mb-2">What went well</p>
              <ul className="space-y-2 text-sm text-slate-700">
                {strengths.map((s) => <li key={s} className="pl-3 border-l-2 border-emerald-200">{s}</li>)}
              </ul>
            </div>
          )}
          {practise.length > 0 && (
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.15em] text-slate-600 mb-2">Good to practise</p>
              <ul className="space-y-2 text-sm text-slate-700">
                {practise.map((s) => <li key={s} className="pl-3 border-l-2 border-slate-200">{s}</li>)}
              </ul>
            </div>
          )}
          <p className="text-sm text-slate-500">The hiring team reviews every interview. They will contact you if there is a match.</p>
        </div>
      )}
    </div>
  )
}

export default function InterviewList({ interviews }) {
  return (
    <div className="space-y-4">
      {interviews.map((row) => <InterviewCard key={row.id} row={row} />)}
    </div>
  )
}
