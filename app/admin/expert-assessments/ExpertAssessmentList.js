'use client'

import { useState } from 'react'
import EieProfile, { BAND_COLORS } from '@/components/EieProfile'

const LEVEL_COLORS = {
  beginner: 'bg-slate-100 text-slate-600',
  developing: 'bg-amber-50 text-amber-700',
  proficient: 'bg-blue-50 text-blue-700',
  advanced: 'bg-indigo-50 text-indigo-700',
  expert: 'bg-emerald-50 text-emerald-700',
  master: 'bg-purple-50 text-purple-700',
}

function scoreColor(s) {
  if (s == null) return 'text-slate-400'
  if (s >= 8) return 'text-emerald-600'
  if (s >= 6) return 'text-indigo-600'
  if (s >= 4) return 'text-amber-600'
  return 'text-red-600'
}

function fmt(d) {
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

const METRIC_LABELS = {
  domain_depth: 'Depth',
  practical_experience: 'Practical',
  communication: 'Communication',
  problem_solving: 'Problem Solving',
  teaching_ability: 'Teaching',
}
function prettyMetric(k) {
  return METRIC_LABELS[k] || k.replace(/_/g, ' ')
}

export default function ExpertAssessmentList({ assessments }) {
  const [openId, setOpenId] = useState(null)

  if (!assessments.length) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50/50 px-6 py-16 text-center">
        <p className="text-slate-500">No expert interviews yet.</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {assessments.map((a) => {
        const open = openId === a.id
        const report = a.report || {}
        const internal = report.internal_scores || {}
        const transcript = Array.isArray(a.transcript) ? a.transcript : []
        return (
          <div key={a.id} className="bg-white border border-slate-200/80 rounded-2xl overflow-hidden">
            {/* Header row */}
            <button
              onClick={() => setOpenId(open ? null : a.id)}
              className="w-full flex items-center justify-between gap-4 px-6 py-4 hover:bg-slate-50 transition text-left"
            >
              <div className="min-w-0">
                <p className="font-semibold text-slate-900 truncate">{a.candidate_name || a.domain || 'Candidate'}</p>
                <p className="text-xs text-slate-500 mt-0.5">{a.domain} · {fmt(a.created_at)}</p>
              </div>
              <div className="flex items-center gap-3.5 flex-shrink-0">
                {a.report?.eie?.decision?.band && (
                  <span className={`hidden md:inline-flex items-center text-[11px] font-semibold px-2.5 py-1 rounded-full border ${BAND_COLORS[a.report.eie.decision.band] || 'bg-slate-100 text-slate-600 border-slate-200'}`}>
                    {a.report.eie.decision.band}
                  </span>
                )}
                {a.top_label && a.peer_count > 1 && (
                  <span className="hidden sm:inline-flex items-center gap-1 text-[11px] font-semibold text-slate-700 bg-slate-100 px-2.5 py-1 rounded-full" title={`Rank within ${a.base_domain} · ${a.peer_count} candidates`}>
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 15l-3.5 2 1-4-3-2.5 4-.3L12 3l1.5 4.2 4 .3-3 2.5 1 4z"/></svg>
                    {a.top_label}
                  </span>
                )}
                <span className={`text-2xl font-semibold tabular-nums ${scoreColor(a.expertise_score)}`}>
                  {a.expertise_score ?? '—'}<span className="text-sm text-slate-400">/10</span>
                </span>
                {a.expertise_level && (
                  <span className={`text-[10px] font-semibold uppercase tracking-[0.1em] px-2.5 py-1 rounded-full capitalize ${LEVEL_COLORS[a.expertise_level] || 'bg-slate-100 text-slate-600'}`}>
                    {a.expertise_level}
                  </span>
                )}
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={`text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`}><path d="M6 9l6 6 6-6"/></svg>
              </div>
            </button>

            {/* Expanded detail */}
            {open && (
              <div className="border-t border-slate-100 bg-slate-50/50 p-6 space-y-6">
                {/* EIE competency evaluation */}
                {report.eie && <EieProfile eie={report.eie} />}

                {/* Rank + confidence summary */}
                <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
                  {a.top_label && a.peer_count > 1 && (
                    <span className="text-slate-600">
                      <span className="font-semibold text-slate-900">{a.top_label}</span> in {a.base_domain}
                      <span className="text-slate-400"> · {a.percentile}th percentile of {a.peer_count}</span>
                    </span>
                  )}
                  {report.overall_confidence != null && (
                    <span className="inline-flex items-center gap-2 text-slate-600">
                      <span className="text-slate-400">Evidence confidence</span>
                      <span className="inline-flex items-center gap-1.5">
                        <span className="w-16 h-1.5 rounded-full bg-slate-100 overflow-hidden inline-block align-middle">
                          <span className="block h-full rounded-full bg-slate-900/80" style={{ width: `${Math.round(report.overall_confidence * 100)}%` }} />
                        </span>
                        <span className="font-semibold text-slate-900 tabular-nums">{Math.round(report.overall_confidence * 100)}%</span>
                      </span>
                    </span>
                  )}
                </div>

                {/* Summary lead */}
                {report.domain_summary && (
                  <p className="text-[15px] text-slate-700 leading-relaxed max-w-3xl">{report.domain_summary}</p>
                )}

                {/* Score tiles — score + confidence + evidence per dimension */}
                {Object.keys(internal).length > 0 && (
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
                    {Object.entries(internal).map(([k, v]) => {
                      const conf = report.score_confidence?.[k]
                      const ev = report.dimension_evidence?.[k]
                      return (
                        <div key={k} className="rounded-xl border border-slate-200/80 bg-white p-3.5" title={ev || ''}>
                          <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400 truncate">{prettyMetric(k)}</p>
                          <div className="flex items-end gap-1 mt-1.5">
                            <span className="text-2xl font-semibold text-slate-900 tabular-nums leading-none">{v}</span>
                            <span className="text-xs text-slate-400 mb-0.5">/10</span>
                          </div>
                          <div className="mt-2.5 h-1 rounded-full bg-slate-100 overflow-hidden">
                            <div className="h-full rounded-full bg-slate-900/80" style={{ width: `${(Number(v) / 10) * 100}%` }} />
                          </div>
                          {conf != null && (
                            <p className="mt-2 text-[10px] text-slate-400">conf {Math.round(Number(conf) * 100)}%</p>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}

                {/* Two columns: assessment | transcript */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Left — qualitative assessment */}
                  <div className="space-y-5">
                    {Array.isArray(report.domain_areas) && report.domain_areas.length > 0 && (
                      <Block label="Verified strengths">
                        <div className="flex flex-wrap gap-1.5">
                          {report.domain_areas.map((x, i) => (
                            <span key={i} className="text-xs px-2.5 py-1 rounded-full bg-white border border-slate-200 text-slate-700">{x}</span>
                          ))}
                        </div>
                      </Block>
                    )}

                    {Array.isArray(report.knowledge_gaps) && report.knowledge_gaps.length > 0 && (
                      <Block label="Knowledge gaps">
                        <ul className="space-y-1.5">
                          {report.knowledge_gaps.map((x, i) => (
                            <li key={i} className="text-sm text-slate-600 flex gap-2.5">
                              <span className="mt-2 w-1 h-1 rounded-full bg-amber-400 flex-shrink-0" />
                              <span>{x}</span>
                            </li>
                          ))}
                        </ul>
                      </Block>
                    )}

                    {report.standout_moment && (
                      <Block label="Standout moment">
                        <blockquote className="border-l-2 border-slate-300 pl-3.5 text-sm text-slate-600 italic leading-relaxed">
                          “{report.standout_moment}”
                        </blockquote>
                      </Block>
                    )}
                  </div>

                  {/* Right — transcript */}
                  <div className="rounded-xl border border-slate-200/80 bg-white p-4">
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-400">Transcript</p>
                      <span className="text-[11px] text-slate-400">{transcript.filter((m) => m.role !== 'assistant').length} answers</span>
                    </div>
                    <div className="space-y-3.5 max-h-[440px] overflow-y-auto pr-1">
                      {transcript.map((m, i) => (
                        <div key={i}>
                          <p className={`text-[10px] font-semibold uppercase tracking-[0.1em] mb-1 ${m.role === 'assistant' ? 'text-slate-500' : 'text-slate-400'}`}>
                            {m.role === 'assistant' ? 'Maya' : 'Candidate'}
                          </p>
                          <p className={`text-sm leading-relaxed ${m.role === 'assistant' ? 'text-slate-900' : 'text-slate-600'}`}>{m.content}</p>
                        </div>
                      ))}
                      {transcript.length === 0 && <p className="text-sm text-slate-400">No transcript saved.</p>}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

function Block({ label, children }) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-400 mb-2">{label}</p>
      {children}
    </div>
  )
}

