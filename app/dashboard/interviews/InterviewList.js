'use client'

import { useState } from 'react'

// ─── Helpers ────────────────────────────────────────────────────────────────

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

const REC_META = {
  strong_yes: { label: 'Strong Yes', cls: 'bg-emerald-50 text-emerald-700 border border-emerald-200' },
  yes:        { label: 'Yes',        cls: 'bg-indigo-50 text-indigo-600 border border-indigo-200' },
  maybe:      { label: 'Maybe',      cls: 'bg-amber-50 text-amber-700 border border-amber-200' },
  no:         { label: 'No',         cls: 'bg-red-50 text-red-700 border border-red-200' },
}

// ─── Inline sub-components ───────────────────────────────────────────────────

const SectionLabel = ({ children }) => (
  <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-500 mb-2">{children}</p>
)

const ScoreBar = ({ score, size = 'md' }) => (
  <div className={`flex items-center gap-2 ${size === 'sm' ? 'w-24' : 'flex-1'}`}>
    <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
      <div
        className="h-2 bg-indigo-500 rounded-full transition-all"
        style={{ width: `${score * 10}%` }}
      />
    </div>
    <span className="text-xs font-bold text-indigo-600 w-5 text-right">{score}</span>
  </div>
)

// ─── Card ─────────────────────────────────────────────────────────────────────

function InterviewCard({ row }) {
  const [open, setOpen] = useState(false)
  const report = row.report || {}

  const strengths      = Array.isArray(report.strengths)    ? report.strengths    : []
  const concerns        = Array.isArray(report.concerns)     ? report.concerns     : []
  const rubric          = Array.isArray(report.rubric)       ? report.rubric       : []
  const riskFactors     = Array.isArray(report.risk_factors) ? report.risk_factors : []
  const internalScores  = report.internal_scores || null

  const recMeta = REC_META[report.recommendation] || null

  const INTERNAL_SCORE_KEYS = [
    'technical', 'communication', 'problem_solving',
    'behavioral', 'confidence', 'role_fit',
  ]

  return (
    <div
      className={`group bg-white border rounded-2xl overflow-hidden transition-all ${
        open
          ? 'border-indigo-300 shadow-[0_10px_30px_-12px_rgba(79,70,229,0.25)]'
          : 'border-slate-200 hover:border-indigo-400 hover:shadow-[0_10px_30px_-12px_rgba(79,70,229,0.25)]'
      }`}
    >
      {/* ── Collapsed header ─────────────────────────────────────────────── */}
      <div
        className="flex items-center justify-between gap-4 p-6 cursor-pointer select-none"
        onClick={() => setOpen((v) => !v)}
      >
        <div className="min-w-0 flex-1">
          <p className="text-lg font-bold text-slate-900 truncate group-hover:text-indigo-600 transition-colors">
            {row.job_title || 'Untitled Job'}
          </p>
          <p className="text-sm text-slate-500 mt-1">
            {row.job_role ? `${row.job_role} · ` : ''}{relativeTime(row.created_at)}
          </p>
        </div>

        <div className="flex items-center gap-3 flex-shrink-0">
          {report.score != null && (
            <span className="text-sm font-bold text-indigo-600 whitespace-nowrap">{report.score}/10</span>
          )}
          {recMeta && (
            <span className={`hidden sm:inline-flex text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full whitespace-nowrap ${recMeta.cls}`}>
              {recMeta.label}
            </span>
          )}
          <svg
            width="16" height="16" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"
            className={`text-slate-400 transition-transform duration-200 flex-shrink-0 ${open ? 'rotate-180' : ''}`}
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </div>
      </div>

      {/* ── Expanded panel ───────────────────────────────────────────────── */}
      {open && (
        <div className="px-6 pb-6 pt-5 bg-slate-50/50 border-t border-slate-100 space-y-5">

          {/* Recommendation badge (mobile, hidden in header on small screens) */}
          {recMeta && (
            <span className={`sm:hidden inline-flex text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full ${recMeta.cls}`}>
              {recMeta.label}
            </span>
          )}

          {/* Section 1 — Summary */}
          {report.summary && (
            <div>
              <SectionLabel>Summary</SectionLabel>
              <p className="text-slate-700 text-sm leading-relaxed">{report.summary}</p>
            </div>
          )}

          {/* Section 2 — Highlight Quote */}
          {report.highlight_quote && (
            <div>
              <SectionLabel>Highlight</SectionLabel>
              <div className="border-l-2 border-indigo-300 bg-indigo-50/40 pl-4 py-3 rounded-r-xl">
                <p className="text-sm italic text-slate-600">"{report.highlight_quote}"</p>
              </div>
            </div>
          )}

          {/* Section 3 — Strengths & Concerns */}
          {(strengths.length > 0 || concerns.length > 0) && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {strengths.length > 0 && (
                <div>
                  <SectionLabel>Strengths</SectionLabel>
                  <ul className="space-y-2">
                    {strengths.map((s, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-slate-700">
                        <span className="mt-[3px] flex-shrink-0 w-2 h-2 rounded-full bg-emerald-500" />
                        {s}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {concerns.length > 0 && (
                <div>
                  <SectionLabel>Concerns</SectionLabel>
                  <ul className="space-y-2">
                    {concerns.map((c, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-slate-700">
                        <svg className="mt-[2px] flex-shrink-0 text-amber-500" width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                        </svg>
                        {c}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* Section 4 — Internal Scores */}
          {internalScores && (
            <div>
              <SectionLabel>Dimension Scores</SectionLabel>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
                {INTERNAL_SCORE_KEYS.map((key) => {
                  const val = internalScores[key]
                  if (val == null) return null
                  const label = key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
                  return (
                    <div key={key} className="flex items-center gap-3">
                      <span className="text-xs text-slate-500 w-28 flex-shrink-0">{label}</span>
                      <ScoreBar score={val} />
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Section 5 — Technical & Behavioral Assessment */}
          {(report.technical_assessment || report.behavioral_assessment) && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {report.technical_assessment && (
                <div>
                  <SectionLabel>Technical Assessment</SectionLabel>
                  <p className="text-sm text-slate-600 leading-relaxed">{report.technical_assessment}</p>
                </div>
              )}
              {report.behavioral_assessment && (
                <div>
                  <SectionLabel>Behavioral Assessment</SectionLabel>
                  <p className="text-sm text-slate-600 leading-relaxed">{report.behavioral_assessment}</p>
                </div>
              )}
            </div>
          )}

          {/* Section 6 — Rubric */}
          {rubric.length > 0 && (
            <div>
              <SectionLabel>Evaluation Rubric</SectionLabel>
              <div className="hidden sm:grid grid-cols-[1fr_100px_1fr] gap-3 px-2 mb-1">
                <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Skill</span>
                <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Score</span>
                <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Evidence</span>
              </div>
              <div className="divide-y divide-slate-100 border border-slate-200 rounded-2xl overflow-hidden bg-white">
                {rubric.map((item, i) => (
                  <div key={i} className="grid grid-cols-1 sm:grid-cols-[1fr_100px_1fr] gap-2 sm:gap-3 px-4 py-3 items-center">
                    <span className="text-sm font-semibold text-slate-700">{item.skill}</span>
                    <ScoreBar score={item.score} size="sm" />
                    <span className="text-xs text-slate-500 leading-relaxed">{item.evidence}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Section 7 — Risk Factors */}
          {riskFactors.length > 0 && (
            <div>
              <SectionLabel>Risk Factors</SectionLabel>
              <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-3 space-y-1.5">
                {riskFactors.map((risk, i) => (
                  <div key={i} className="flex items-start gap-2 text-sm text-red-700">
                    <span className="mt-[5px] flex-shrink-0 w-1.5 h-1.5 rounded-full bg-red-400" />
                    {risk}
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>
      )}
    </div>
  )
}

// ─── List ─────────────────────────────────────────────────────────────────────

export default function InterviewList({ interviews }) {
  return (
    <div className="space-y-4">
      {interviews.map((row) => (
        <InterviewCard key={row.id} row={row} />
      ))}
    </div>
  )
}
