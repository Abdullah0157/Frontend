// Shared renderer for an EIE competency profile (decision, competencies with
// credible intervals + evidence, interview-quality, fairness footer). Used by
// the admin Expert Rubrics (Maya) and the company/admin candidate views (Iris).

export const BAND_COLORS = {
  'Strong Hire': 'bg-emerald-50 text-emerald-700 border-emerald-200',
  'Hire': 'bg-emerald-50 text-emerald-700 border-emerald-200',
  'Hire with Reservations': 'bg-blue-50 text-blue-700 border-blue-200',
  'Borderline': 'bg-amber-50 text-amber-700 border-amber-200',
  'Needs More Evidence': 'bg-slate-100 text-slate-600 border-slate-200',
  'No Hire': 'bg-red-50 text-red-700 border-red-200',
  'Strong No Hire': 'bg-red-50 text-red-700 border-red-200',
}

export default function EieProfile({ eie }) {
  if (!eie) return null
  const d = eie.decision || {}
  const measured = (eie.competencies || []).filter((c) => c.state === 'measured')
  const unknown = (eie.competencies || []).filter((c) => c.state === 'unknown')
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      {/* Header: decision + metrics */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div className="flex items-center gap-3">
          <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">AI Evaluation</span>
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
          <span className="text-slate-500">Skills covered <span className="font-semibold text-slate-900 tabular-nums">{Math.round((eie.coverage || 0) * 100)}%</span></span>
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

      {/* Interview Quality — the interviewer's report card */}
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
            {eie.interview_quality.questions_asked} questions asked · {Math.round(eie.interview_quality.efficiency * 100)}% productive
            {eie.interview_quality.evasions > 0 ? ` · ${eie.interview_quality.evasions} dodged answer(s)` : ''}
          </span>
          {eie.interview_quality.flags?.length > 0 && (
            <span className="text-[11px] text-amber-700">{eie.interview_quality.verdict}</span>
          )}
        </div>
      )}

      {d.reason && <p className="text-sm text-slate-600 -mt-1 mb-1.5">{d.reason}</p>}
      {d.calibration === 'uncalibrated_prior' && (
        <p className="text-[11px] text-slate-400 mb-5">⚠︎ Heads up: the pass mark is a starting estimate. It hasn't been tuned against real hiring results yet.</p>
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
          Transcript (names hidden to keep scoring fair){eie.audit.redactions ? ` · ${eie.audit.redactions} redactions` : ''}{eie.rater_count > 1 ? ' · ensemble + adversarial verify' : ''}
        </p>
      )}

      {/* Unknowns + follow-ups */}
      {unknown.length > 0 && (
        <div className="mt-5">
          <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-400 mb-2">Not enough evidence to score these skills</p>
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
