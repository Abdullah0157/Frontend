'use client'

import Link from 'next/link'

// The hiring team's view of one written assessment: result, sections, resume
// versus results, skills, the code and review the candidate wrote, integrity
// notes, and the questions to ask in the voice interview. Presentational only;
// app/company/assessments/[sessionId] loads the data with access checks.

const BAND_STYLE = {
  strong: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  good: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  borderline: 'bg-amber-50 text-amber-700 border-amber-200',
  not_yet: 'bg-red-50 text-red-700 border-red-200',
}
const BAND_LABEL = { strong: 'Strong', good: 'Good', borderline: 'Borderline', not_yet: 'Not yet' }
const VERDICT = {
  confirmed: { label: 'Backed up by the test', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  partly: { label: 'Partly backed up', cls: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
  not_confirmed: { label: 'Not backed up', cls: 'bg-red-50 text-red-700 border-red-200' },
  not_tested: { label: 'Not tested', cls: 'bg-slate-100 text-slate-600 border-slate-200' },
}
const LEVEL = { L2: 'Junior', L3: 'Mid', L4: 'Senior', L5: 'Lead' }

const Card = ({ title, children, right }) => (
  <section className="bg-white border border-slate-200 rounded-[2rem] p-6 md:p-8 shadow-sm mb-6 break-inside-avoid">
    <div className="flex items-center justify-between mb-4 gap-4">
      <h2 className="text-xs font-black uppercase tracking-[0.3em] text-slate-500">{title}</h2>
      {right}
    </div>
    {children}
  </section>
)

export default function WrittenReportView({ data }) {
  const r = data.report
  if (!r) return <div className="px-8 py-10"><p className="text-slate-500">This test is still being marked. Check back in a minute.</p></div>
  const strong = r.skills.filter((k) => k.level === 'strong').slice(0, 8)
  const weakAll = r.skills.filter((k) => k.level === 'weak').sort((a, b) => b.items - a.items || a.score - b.score)
  const weak = weakAll.slice(0, 8)

  return (
    <div className="px-4 md:px-8 py-10 max-w-5xl">
      {data.job && (
        <Link href={`/company/jobs/${data.job.id}`} className="text-xs font-black uppercase tracking-widest text-indigo-600 print:hidden">
          ← {data.job.title}
        </Link>
      )}
      <div className="flex flex-wrap items-end justify-between gap-6 mt-4 mb-8">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.4em] text-indigo-600 mb-2">Written assessment report</p>
          <h1 className="text-3xl md:text-4xl font-black text-slate-900">{data.candidate.name}</h1>
          <p className="text-slate-500 text-sm mt-2">
            {data.test.familyLabel || 'Assessment'} · {data.test.trackLabel || data.test.track} · {data.test.levelLabel || LEVEL[data.test.level] || data.test.level}
            {data.test.language && ` · coded in ${data.test.language}`}
            {data.test.completedAt && ` · ${new Date(data.test.completedAt).toLocaleDateString('en-GB', { timeZone: 'UTC', day: 'numeric', month: 'short', year: 'numeric' })}`}
          </p>
        </div>
        <div className="flex items-center gap-4">
          <span className={`px-4 py-2 rounded-full border text-sm font-black uppercase tracking-widest ${BAND_STYLE[r.band] || ''}`}>
            {BAND_LABEL[r.band] || 'Not scored'}
          </span>
          <span className="text-5xl font-black text-slate-900">{r.overall ?? '—'}<span className="text-lg text-slate-400">/100</span></span>
          <button onClick={() => window.print()} className="print:hidden text-xs font-black uppercase tracking-widest px-4 py-2 rounded-full border border-slate-300 hover:bg-slate-50">
            Print / PDF
          </button>
        </div>
      </div>

      <Card title="Sections">
        <div className="grid gap-4">
          {r.sections.map((s) => (
            <div key={s.key}>
              <div className="flex justify-between text-sm mb-1">
                <span className="font-bold text-slate-800">{s.label} <span className="text-slate-400 font-normal">· counts {Math.round(s.weight)}% · answered {s.answered} of {s.planned}</span></span>
                <span className="font-black text-slate-900">{s.score ?? '—'}</span>
              </div>
              <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                <div className="h-full bg-indigo-500" style={{ width: `${s.score || 0}%` }} />
              </div>
            </div>
          ))}
        </div>
        {r.summary && <p className="text-slate-700 text-sm leading-relaxed mt-6">{r.summary}</p>}
      </Card>

      {r.resumeCheck?.claims?.length > 0 && (
        <Card title="Resume versus results">
          <div className="grid gap-3">
            {r.resumeCheck.claims.map((c, i) => (
              <div key={i} className="flex flex-wrap items-start justify-between gap-3 border border-slate-200 rounded-xl p-4">
                <div className="flex-1 min-w-[240px]">
                  <p className="text-sm text-slate-800">“{c.quote}”</p>
                  {c.skills.length > 0 && (
                    <p className="text-xs text-slate-400 mt-1">
                      Tested as: {c.skills.map((code) => r.skills.find((k) => k.skill === code)?.label || code).join(', ')}
                      {c.score != null && ` · ${Math.round(c.score * 100)}%`}
                    </p>
                  )}
                </div>
                <span className={`px-3 py-1 rounded-full border text-xs font-bold ${VERDICT[c.verdict]?.cls}`}>{VERDICT[c.verdict]?.label}</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      <div className="grid md:grid-cols-2 gap-6">
        <Card title="Strongest skills">
          {strong.length ? strong.map((k) => (
            <p key={k.skill} className="text-sm text-slate-700 py-1 flex justify-between"><span>{k.label}</span><span className="font-bold text-emerald-700">{Math.round(k.score * 100)}%</span></p>
          )) : <p className="text-sm text-slate-400">None clearly strong.</p>}
        </Card>
        <Card title="Weakest skills">
          {weak.length ? weak.map((k) => (
            <p key={k.skill} className="text-sm text-slate-700 py-1 flex justify-between"><span>{k.label}</span><span className="font-bold text-red-700">{Math.round(k.score * 100)}%</span></p>
          )) : <p className="text-sm text-slate-400">No clear weak spots.</p>}
          {weakAll.length > weak.length && <p className="text-xs text-slate-400 mt-2">and {weakAll.length - weak.length} more weak areas</p>}
        </Card>
      </div>

      {r.english && (
        <Card title="English level" right={r.english.meetsRequired && (
          <span className={`px-3 py-1 rounded-full border text-xs font-bold ${r.english.meetsRequired === 'yes' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : r.english.meetsRequired === 'borderline' ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
            {r.english.meetsRequired === 'yes' ? `Meets ${r.english.requiredLevel}` : r.english.meetsRequired === 'borderline' ? `Borderline for ${r.english.requiredLevel}` : `Below ${r.english.requiredLevel}`}
          </span>
        )}>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
            <div><p className="text-3xl font-black text-slate-900">{r.english.cefr || '—'}</p><p className="text-xs text-slate-500">overall</p></div>
            {['listening', 'speaking', 'reading'].map((k) => (
              <div key={k}><p className="text-2xl font-black text-slate-900">{r.english.skills?.[k]?.cefr || '—'}</p><p className="text-xs text-slate-500">{k}</p></div>
            ))}
          </div>
          <p className="text-xs text-slate-400 mt-4">{r.english.note}</p>
        </Card>
      )}

      {(data.speaking || []).length > 0 && (
        <Card title="Spoken answers">
          <div className="grid gap-4">
            {data.speaking.map((sp, i) => (
              <div key={i} className="border border-slate-200 rounded-xl p-4">
                <div className="flex flex-wrap justify-between gap-3 mb-2">
                  <p className="text-sm font-bold text-slate-800">{(sp.mode || '').replace('_', ' ')}: {sp.task}</p>
                  <span className="text-sm font-black text-slate-900">{sp.score != null ? `${Math.round(sp.score * 100)}%` : 'to review'}</span>
                </div>
                {sp.needsHumanReview && <p className="text-xs text-amber-700 mb-2">The speech recogniser was unsure. Please listen and judge this answer yourself.</p>}
                {sp.audioId && data.sessionId && (
                  <audio controls preload="none" className="w-full mb-2" src={`/api/company/written-reports/${data.sessionId}/audio/${sp.audioId}`} />
                )}
                <p className="text-xs text-slate-500">Transcript: “{sp.transcript || 'no speech'}”</p>
                {sp.note && <p className="text-xs text-slate-500 mt-1">{sp.note}</p>}
              </div>
            ))}
          </div>
        </Card>
      )}

      {(data.typing || []).map((t, i) => (
        <Card key={`t${i}`} title="Typing test" right={t.passed != null && (
          <span className={`px-3 py-1 rounded-full border text-xs font-bold ${t.passed ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200'}`}>
            {t.passed ? 'Passed the pass mark' : 'Below the pass mark'}
          </span>
        )}>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div><p className="text-3xl font-black text-slate-900">{t.netWpm ?? '—'}</p><p className="text-xs text-slate-500">net words per minute</p></div>
            <div><p className="text-3xl font-black text-slate-900">{t.accuracy != null ? `${t.accuracy}%` : '—'}</p><p className="text-xs text-slate-500">accuracy</p></div>
            <div><p className="text-3xl font-black text-slate-900">{t.passMarks ? `${t.passMarks.net_wpm} / ${t.passMarks.accuracy}%` : '—'}</p><p className="text-xs text-slate-500">pass mark</p></div>
          </div>
        </Card>
      ))}

      {(data.writing || []).map((w, i) => (
        <Card key={`w${i}`} title="Written answer" right={w.score != null && <span className="text-sm font-black text-slate-900">{Math.round(w.score * 100)}%</span>}>
          <p className="text-sm text-slate-700 mb-3">{w.task}</p>
          {w.needsHumanReview && <p className="text-xs text-amber-700 mb-3">The two AI markers disagreed. Please read this answer yourself.</p>}
          {w.markers[0]?.dimensions?.length > 0 && (
            <div className="grid sm:grid-cols-2 gap-x-6 gap-y-1 mb-3">
              {w.markers[0].dimensions.map((d) => (
                <p key={d.name} className="text-xs text-slate-600 flex justify-between"><span>{d.name}</span><span className="font-bold">{Math.round(d.score * 100)}%</span></p>
              ))}
            </div>
          )}
          {w.markers[0]?.note && <p className="text-sm text-slate-600 mb-3">Marker: {w.markers[0].note}</p>}
          <details>
            <summary className="text-xs font-bold text-indigo-600 cursor-pointer">Show their answer{w.words != null ? ` (${w.words} words)` : ''}</summary>
            <p className="mt-3 text-sm text-slate-700 whitespace-pre-wrap">{w.answer || '(no answer)'}</p>
          </details>
        </Card>
      ))}

      {data.coding.map((c, i) => (
        <Card key={i} title="Coding task" right={c.tests && <span className="text-sm font-black text-slate-900">{c.tests.passed} of {c.tests.total} tests passed</span>}>
          <p className="text-sm text-slate-700 mb-3">{c.task}</p>
          {c.tests?.failed?.length > 0 && (
            <p className="text-xs text-slate-500 mb-3">Failed: {c.tests.failed.map((f) => f.name).join(', ')}</p>
          )}
          {c.tests?.infra_error && <p className="text-xs text-amber-700 mb-3">The tests could not run, so this was marked on code quality only.</p>}
          {c.quality?.note && <p className="text-sm text-slate-600 mb-3">Code quality: {c.quality.note}</p>}
          <details>
            <summary className="text-xs font-bold text-indigo-600 cursor-pointer">Show the code</summary>
            <pre className="mt-3 overflow-x-auto rounded-xl bg-slate-900 text-slate-100 text-xs p-4">{c.code || '(no code submitted)'}</pre>
          </details>
        </Card>
      ))}

      {data.reviews.map((v, i) => (
        <Card key={i} title="Code review" right={v.score != null && <span className="text-sm font-black text-slate-900">{Math.round(v.score * 100)}%</span>}>
          <p className="text-sm text-slate-700 mb-3">{v.task}</p>
          {v.needsHumanReview && <p className="text-xs text-amber-700 mb-3">The two AI markers disagreed. Please read this answer yourself.</p>}
          {v.markers[0]?.note && <p className="text-sm text-slate-600 mb-3">Marker: {v.markers[0].note}</p>}
          <details>
            <summary className="text-xs font-bold text-indigo-600 cursor-pointer">Show their review</summary>
            <p className="mt-3 text-sm text-slate-700 whitespace-pre-wrap">{v.answer || '(no answer)'}</p>
          </details>
        </Card>
      ))}

      <Card
        title="Integrity notes"
        right={<span className={`px-3 py-1 rounded-full border text-xs font-bold ${r.integrity?.level === 'review' ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200'}`}>
          {r.integrity?.level === 'review' ? 'For review' : 'Nothing unusual'}
        </span>}
      >
        {(r.integrity?.notes || []).length > 0
          ? <ul className="list-disc pl-5 text-sm text-slate-700 space-y-1">{r.integrity.notes.map((n, i) => <li key={i}>{n}</li>)}</ul>
          : <p className="text-sm text-slate-500">No unusual activity was noted.</p>}
        {r.integrity?.disclaimer && <p className="text-xs text-slate-400 mt-3">{r.integrity.disclaimer}</p>}
      </Card>

      {(r.followups || []).length > 0 && (
        <Card title="Ask in the voice interview">
          <ol className="list-decimal pl-5 space-y-3">
            {r.followups.map((q, i) => (
              <li key={i} className="text-sm text-slate-800">
                {q.question}
                <p className="text-xs text-slate-400 mt-1">{q.why}</p>
              </li>
            ))}
          </ol>
        </Card>
      )}

      {(r.strengths?.length > 0 || r.concerns?.length > 0) && (
        <div className="grid md:grid-cols-2 gap-6">
          <Card title="Strengths">{r.strengths.map((x, i) => <p key={i} className="text-sm text-slate-700 py-1">• {x}</p>)}</Card>
          <Card title="Concerns">{r.concerns.map((x, i) => <p key={i} className="text-sm text-slate-700 py-1">• {x}</p>)}</Card>
        </div>
      )}

      <p className="text-xs text-slate-400 mt-4">
        {r.note || 'This is a recommendation. Your team makes the decision.'}
        {r.flags?.length > 0 && ` Marking notes: ${r.flags.map((f) => f.kind.replace(/_/g, ' ')).join(', ')}.`}
      </p>
    </div>
  )
}
