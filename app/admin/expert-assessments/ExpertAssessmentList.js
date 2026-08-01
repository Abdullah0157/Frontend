'use client'

import { useState } from 'react'

const LEVEL_COLORS = {
  beginner: 'bg-slate-100 text-slate-600',
  developing: 'bg-amber-50 text-amber-700',
  proficient: 'bg-blue-50 text-blue-700',
  advanced: 'bg-indigo-50 text-indigo-700',
  expert: 'bg-emerald-50 text-emerald-700',
  master: 'bg-purple-50 text-purple-700',
}

const BAND_COLORS = {
  'Strong Hire': 'bg-emerald-50 text-emerald-700 border-emerald-200',
  'Hire': 'bg-emerald-50 text-emerald-700 border-emerald-200',
  'Hire with Reservations': 'bg-blue-50 text-blue-700 border-blue-200',
  'Borderline': 'bg-amber-50 text-amber-700 border-amber-200',
  'Needs More Evidence': 'bg-slate-100 text-slate-600 border-slate-200',
  'No Hire': 'bg-red-50 text-red-700 border-red-200',
  'Strong No Hire': 'bg-red-50 text-red-700 border-red-200',
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
                {/* EIE competency evaluation (Phase 1) */}
                {report.eie && <EieBlock eie={report.eie} />}

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

// ── EIE competency evaluation block (Phase 1) ──────────────────────────────
function EieBlock({ eie }) {
  const d = eie.decision || {}
  const measured = (eie.competencies || []).filter((c) => c.state === 'measured')
  const unknown = (eie.competencies || []).filter((c) => c.state === 'unknown')
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      {/* Header: decision + metrics */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div className="flex items-center gap-3">
          <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">Evaluation · EIE</span>
          {d.band && (
            <span className={`inline-flex items-center text-xs font-semibold px-2.5 py-1 rounded-full border ${BAND_COLORS[d.band] || 'bg-slate-100 text-slate-600 border-slate-200'}`}>
              {d.band}
            </span>
          )}
          {d.p_success != null && (
            <span className="text-sm text-slate-500" title={`P(clears the role bar θ≥${d.bar}) vs hire threshold ${Math.round((d.cost_threshold || 0) * 100)}%`}>
              P(success) <span className="font-semibold text-slate-900 tabular-nums">{Math.round(d.p_success * 100)}%</span>
            </span>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-sm">
          {eie.composite_score != null && (
            <span className="text-slate-500">Composite <span className="font-semibold text-slate-900 tabular-nums">{eie.composite_score}</span><span className="text-slate-400">/100</span></span>
          )}
          <span className="text-slate-500">Coverage <span className="font-semibold text-slate-900 tabular-nums">{Math.round((eie.coverage || 0) * 100)}%</span></span>
          {eie.overall_reliability != null && (
            <span className="text-slate-500">Reliability <span className="font-semibold text-slate-900 tabular-nums">{Math.round(eie.overall_reliability * 100)}%</span></span>
          )}
          <span className="text-slate-500">Confidence <span className="font-semibold text-slate-900 tabular-nums">{Math.round((eie.overall_confidence || 0) * 100)}%</span></span>
          {eie.rater_count > 1 && (
            <span className="text-slate-500" title="Independent AI raters · profile dependability against rater swaps (G-theory)">
              {eie.rater_count} raters{eie.rater_dependability != null ? <> · dep <span className="font-semibold text-slate-900 tabular-nums">{Math.round(eie.rater_dependability * 100)}%</span></> : null}
            </span>
          )}
        </div>
      </div>

      {/* Interview Quality — Maya's report card (step 6) */}
      {eie.interview_quality && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mb-3 text-sm">
          <span className="inline-flex items-center gap-2">
            <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">Interview Quality</span>
            <span className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold ${
              eie.interview_quality.score >= 74 ? 'bg-emerald-50 text-emerald-700' :
              eie.interview_quality.score >= 50 ? 'bg-amber-50 text-amber-700' : 'bg-red-50 text-red-700'
            }`}>{eie.interview_quality.grade}</span>
            <span className="font-semibold text-slate-900 tabular-nums">{eie.interview_quality.score}<span className="text-slate-400 font-normal">/100</span></span>
          </span>
          <span className="text-slate-400 text-xs">
            {eie.interview_quality.questions_asked} questions · efficiency {Math.round(eie.interview_quality.efficiency * 100)}%
            {eie.interview_quality.evasions > 0 ? ` · ${eie.interview_quality.evasions} evasion(s)` : ''}
          </span>
          {eie.interview_quality.flags?.length > 0 && (
            <span className="text-[11px] text-amber-700">{eie.interview_quality.verdict}</span>
          )}
        </div>
      )}

      {d.reason && <p className="text-sm text-slate-600 -mt-1 mb-1.5">{d.reason}</p>}
      {d.calibration === 'uncalibrated_prior' && (
        <p className="text-[11px] text-slate-400 mb-5">⚠︎ Decision bar is a theory-based prior, not yet calibrated against hire outcomes (Phase 6).</p>
      )}
      {Array.isArray(d.reservations) && d.reservations.length > 0 && (
        <p className="text-sm text-amber-700 mb-5">Reservations: {d.reservations.join(', ')}</p>
      )}

      {/* Competency rows */}
      <div className="space-y-2.5">
        {measured.map((c) => {
          const ev = c.evidence?.[0]
          return (
            <div key={c.id} className="rounded-xl border border-slate-200/80 p-3.5">
              <div className="flex items-center gap-3">
                <span className="text-[11px] font-semibold text-slate-500 w-6 flex-shrink-0">L{c.bars_level}</span>
                <span className="font-medium text-slate-900 text-sm flex-1 min-w-0 truncate">{c.name}</span>
                {c.refuted && <span className="text-[10px] text-red-600 bg-red-50 px-1.5 py-0.5 rounded" title={c.refute_reason || 'rating not defensible from transcript'}>refuted</span>}
                {c.thin && <span className="text-[10px] text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">thin</span>}
                {/* Score bar with 90% credible-interval band + point estimate */}
                <div className="relative w-28 h-1.5 rounded-full bg-slate-100 flex-shrink-0" title={c.ci90 ? `θ ${c.theta} · 90% CI [${c.ci90[0]}, ${c.ci90[1]}]` : ''}>
                  {c.ci_pct && (
                    <div className="absolute top-0 h-full rounded-full bg-slate-300" style={{ left: `${c.ci_pct[0]}%`, width: `${Math.max(2, c.ci_pct[1] - c.ci_pct[0])}%` }} />
                  )}
                  <div className="absolute top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-slate-900 ring-2 ring-white" style={{ left: `calc(${c.score}% - 4px)` }} />
                </div>
                <span className="text-sm font-semibold text-slate-900 tabular-nums w-8 text-right">{c.score}</span>
                <span className="text-[11px] text-slate-400 w-16 text-right flex-shrink-0" title="marginal reliability">G {Math.round((c.reliability || 0) * 100)}%</span>
              </div>
              {c.ci90 && (
                <p className="text-[11px] text-slate-400 mt-1 pl-9">
                  θ {c.theta} · 90% CI [{c.ci90[0]}, {c.ci90[1]}]
                  {c.rater_agreement != null && <span> · {c.rater_count} raters agree {Math.round(c.rater_agreement * 100)}%</span>}
                </p>
              )}
              {ev?.quote && (
                <p className="text-xs text-slate-500 italic mt-1.5 pl-9 leading-relaxed">“{ev.quote}”{ev.turn_ref ? <span className="not-italic text-slate-300"> · turn {ev.turn_ref}</span> : null}</p>
              )}
            </div>
          )
        })}
      </div>

      {/* Audit / fairness footer */}
      {eie.audit?.blinded && (
        <p className="text-[11px] text-slate-400 mt-4 flex items-center gap-1.5">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
          Identity-blinded transcript{eie.audit.redactions ? ` · ${eie.audit.redactions} redactions` : ''}{eie.rater_count > 1 ? ' · ensemble + adversarial verify' : ''}
        </p>
      )}

      {/* Unknowns + follow-ups */}
      {unknown.length > 0 && (
        <div className="mt-5">
          <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-400 mb-2">Unknown — needs more evidence</p>
          <ul className="space-y-1.5">
            {unknown.map((c) => (
              <li key={c.id} className="text-sm text-slate-600 flex gap-2.5">
                <span className="mt-2 w-1 h-1 rounded-full bg-slate-300 flex-shrink-0" />
                <span><span className="text-slate-800 font-medium">{c.name}</span>{c.followup ? <span className="text-slate-400"> — {c.followup}</span> : null}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
