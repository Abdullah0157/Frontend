import Link from 'next/link'
import { query } from '@/lib/db'
import EieProfile from '@/components/EieProfile'
import { jobSteps, verdictFor, sessionTrack, trackLabel, bandLabel } from '@/lib/job-verdict'
import { LEVELS, LANGUAGES } from '@/lib/assessment-blueprint'
import { evidenceText } from '@/lib/report-text'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Candidate — JobStream Admin' }

// Everything we hold on one candidate, in one place: who they are, what we read
// off their resume, and every assessment they've completed. Previously the admin
// list had no detail view at all — you could see that someone had interviewed,
// but not what they said or how they scored.
async function fetchCandidate(userId) {
  const [profile, expert, jobs, tests, applied] = await Promise.all([
    query(
      `SELECT user_id, full_name, resume_filename, resume_pages, resume_chars,
              resume_uploaded_at, linkedin_url, github_url, resume_sections,
              profile_prefs, created_at, updated_at
       FROM user_profiles WHERE user_id = $1`, [userId]
    ).catch(() => ({ rows: [] })),

    // Maya — expert interviews. These were missing from the admin entirely.
    query(
      `SELECT id, domain, expertise_score, expertise_level, report, transcript, created_at
       FROM expert_assessments WHERE candidate_user_id = $1
       ORDER BY created_at DESC`, [userId]
    ).catch(() => ({ rows: [] })),

    // Iris — job interviews.
    query(
      `SELECT ic.id, ic.job_id, ic.name, ic.email, ic.job_fit_score, ic.fit_reasoning, ic.decision,
              ic.report, ic.created_at, j.title AS job_title, j.company
       FROM interview_candidates ic
       LEFT JOIN interview_jobs j ON j.id = ic.job_id
       WHERE ic.user_id = $1
       ORDER BY ic.created_at DESC`, [userId]
    ).catch(() => ({ rows: [] })),

    // Written tests (skills and English), with their reports when marked.
    query(
      `SELECT s.id, s.job_id, s.track, s.role_family, s.seniority_band, s.language, s.state,
              s.started_at, s.completed_at,
              r.overall_score, r.band, r.sections, r.english, r.integrity, r.summary,
              (SELECT count(*)::int FROM assessment_snapshots sn WHERE sn.session_id = s.id) AS photos
       FROM assessment_sessions s
       LEFT JOIN assessment_reports r ON r.session_id = s.id
       WHERE s.candidate_user_id = $1 AND s.form IS NOT NULL
       ORDER BY s.started_at DESC`, [userId]
    ).catch(() => ({ rows: [] })),

    // Every job they have started on: a test, an interview or an application.
    query(
      `SELECT j.id, j.title, COALESCE(NULLIF(j.company, ''), cp.company_name) AS company,
              j.assessment_config, j.required_assessments, j.requires_ai_interview,
              ja.status AS application_status, ja.submitted_at
       FROM interview_jobs j
       LEFT JOIN company_profiles cp ON cp.user_id = j.owner_id
       LEFT JOIN job_applications ja ON ja.job_id = j.id AND ja.candidate_user_id = $1
       WHERE j.id IN (
         SELECT job_id FROM assessment_sessions WHERE candidate_user_id = $1 AND job_id IS NOT NULL
         UNION SELECT job_id FROM interview_candidates WHERE user_id = $1
         UNION SELECT job_id FROM job_applications WHERE candidate_user_id = $1
       )`, [userId]
    ).catch(() => ({ rows: [] })),
  ])
  return {
    profile: profile.rows?.[0] || null,
    expert: expert.rows || [],
    jobs: jobs.rows || [],
    tests: tests.rows || [],
    applied: applied.rows || [],
  }
}

const fmt = (d) => (d ? new Date(d).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' }) : '—')

function Stat({ label, value }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="text-lg font-semibold text-slate-900 mt-0.5">{value}</p>
    </div>
  )
}

// The full exchange, collapsed by default so a long interview doesn't bury the
// scores. Unanswered turns are shown explicitly rather than hidden — an empty
// interview should look obviously empty, not just produce low numbers.
function Transcript({ turns }) {
  const list = Array.isArray(turns) ? turns : []
  const answers = list.filter((m) => m.role !== 'assistant' && m.content !== '(no response)')
  const missed = list.filter((m) => m.role !== 'assistant' && m.content === '(no response)')

  if (list.length === 0) {
    return <p className="text-xs text-slate-500 mt-4">No transcript recorded.</p>
  }

  return (
    <details className="mt-4 group">
      <summary className="cursor-pointer text-xs font-medium text-slate-500 hover:text-slate-800 select-none">
        Transcript · {answers.length} answered
        {missed.length > 0 && <span className="text-amber-600"> · {missed.length} unanswered</span>}
        <span className="text-slate-300 group-open:hidden"> — show</span>
        <span className="text-slate-300 hidden group-open:inline"> — hide</span>
      </summary>
      <div className="mt-3 space-y-3 border-l-2 border-slate-100 pl-4">
        {list.map((m, i) => {
          const isAsk = m.role === 'assistant'
          const noAnswer = !isAsk && m.content === '(no response)'
          return (
            <div key={i}>
              <p className={`text-[10px] font-semibold uppercase tracking-wide ${isAsk ? 'text-indigo-500' : noAnswer ? 'text-amber-600' : 'text-slate-500'}`}>
                {isAsk ? 'Maya' : 'Candidate'}
              </p>
              <p className={`text-sm mt-0.5 leading-relaxed ${noAnswer ? 'text-amber-700 italic' : 'text-slate-700'}`}>
                {noAnswer ? 'No answer was captured for this question.' : m.content}
              </p>
            </div>
          )
        })}
      </div>
    </details>
  )
}

function Empty({ children }) {
  return (
    <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50/60 px-5 py-10 text-center">
      <p className="text-sm text-slate-500">{children}</p>
    </div>
  )
}

const TONE = {
  good: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  warn: 'bg-amber-50 text-amber-700 border-amber-200',
  bad: 'bg-red-50 text-red-700 border-red-200',
  muted: 'bg-slate-100 text-slate-600 border-slate-200',
}
const STEP = {
  pass: { tone: 'good', mark: '✓', text: 'meets the bar' },
  borderline: { tone: 'warn', mark: '!', text: 'borderline' },
  fail: { tone: 'bad', mark: '✕', text: 'below the bar' },
  missing: { tone: 'muted', mark: '–', text: 'not done' },
  marking: { tone: 'muted', mark: '…', text: 'being marked' },
}
const DECISION = { hire: 'Hired', reject: 'Rejected' }
const MEETS = { yes: ['good', 'Meets'], borderline: ['warn', 'Borderline'], no: ['bad', 'Below'] }

function Badge({ tone, children }) {
  return <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${TONE[tone]}`}>{children}</span>
}

function reasonLine(v, steps) {
  if (steps.length === 0) return 'This job has no test or interview set.'
  if (v.key === 'recommended') return 'Every step clears the bar. A person still makes the final decision.'
  if (v.key === 'consider') return `Borderline: ${v.reasons.join(', ')}. Worth a closer look before deciding.`
  if (v.key === 'not_fit') return `Below the bar: ${v.reasons.join(', ')}.`
  return `Still to do: ${v.reasons.join(', ')}.`
}

function applicationLine(job) {
  if (job.application_status === 'submitted') return `Applied ${fmt(job.submitted_at)}`
  if (job.application_status === 'withdrawn') return 'Withdrew'
  return 'Application not sent yet'
}

// How the verdict is worked out, in the admin's own words. The same rules
// live in lib/job-verdict.js.
function VerdictRules() {
  return (
    <details className="mb-3 rounded-xl border border-slate-200 bg-slate-50/60 px-4 py-3 text-sm">
      <summary className="cursor-pointer select-none font-medium text-slate-700">How the verdict is worked out</summary>
      <ul className="mt-3 space-y-1.5 text-slate-600">
        <li><Badge tone="good">Recommended</Badge> every step is done and clears the bar: skills test Strong (80+) or Good (65+), English at the job&apos;s level, AI interview Yes, no integrity notes.</li>
        <li><Badge tone="warn">Consider</Badge> everything is done but something is borderline: skills Borderline (50 to 64), English up to 5 points under the level, interview Maybe, or integrity notes to check.</li>
        <li><Badge tone="bad">Not a fit yet</Badge> a step is below the bar: skills Not yet (under 50), English more than 5 points under the level, or interview No.</li>
        <li><Badge tone="muted">Not finished</Badge> a step is missing or still being marked.</li>
      </ul>
      <p className="mt-3 text-xs text-slate-500">This only advises. Integrity notes never reject anyone on their own, and a person always makes the hiring decision.</p>
    </details>
  )
}

function JobCard({ job, tests, interview }) {
  const steps = jobSteps(job, tests, interview)
  const v = verdictFor(steps)
  return (
    <div className="rounded-xl border border-slate-200 bg-white">
      <div className="flex flex-wrap items-start justify-between gap-3 px-5 pt-5">
        <div className="min-w-0">
          <p className="font-semibold text-slate-900">{job.title || 'Job'}</p>
          <p className="mt-0.5 text-xs text-slate-500">{[job.company, applicationLine(job)].filter(Boolean).join(' · ')}</p>
        </div>
        <Badge tone={v.tone}>{v.label}</Badge>
      </div>
      <p className="px-5 pt-2 pb-4 text-sm text-slate-600">{reasonLine(v, steps)}</p>
      {steps.length > 0 && (
        <ul className="divide-y divide-slate-100 border-t border-slate-100">
          {steps.map((step) => {
            const st = STEP[step.status]
            return (
              <li key={step.kind} className="flex items-start gap-3 px-5 py-2.5 text-sm">
                <span aria-hidden="true" className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[11px] font-bold ${TONE[st.tone]}`}>{st.mark}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-slate-800">{step.label}<span className="sr-only">: {st.text}</span></p>
                  <p className="text-xs text-slate-500">{step.detail}</p>
                  {step.notes?.length > 0 && (
                    <ul className="mt-1 list-disc space-y-0.5 pl-4 text-xs text-amber-700">
                      {step.notes.map((n) => <li key={n}>{n}</li>)}
                    </ul>
                  )}
                </div>
                {step.sessionId && step.status !== 'missing' && (
                  <Link href={`/company/assessments/${step.sessionId}`} className="shrink-0 text-xs font-medium text-indigo-600 hover:text-indigo-700">Report →</Link>
                )}
              </li>
            )
          })}
        </ul>
      )}
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 px-5 py-3 text-xs">
        <span className="text-slate-500">Decision: <span className="font-medium text-slate-800">{DECISION[interview?.decision] || 'None yet'}</span></span>
        <Link href={`/company/jobs/${job.id}`} className="font-medium text-indigo-600 hover:text-indigo-700">Open job →</Link>
      </div>
    </div>
  )
}

function TestCard({ t, jobTitle }) {
  const track = sessionTrack(t)
  const overall = t.overall_score == null ? null : Math.round(t.overall_score * 10)
  const level = LEVELS[t.seniority_band]?.label
  const e = t.english
  const meets = e?.meetsRequired && MEETS[e.meetsRequired]
  const notes = t.integrity?.level === 'review' ? t.integrity.notes || [] : []
  const sections = Array.isArray(t.sections) ? t.sections : []
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold text-slate-900">
            {trackLabel(track)}{level && track !== 'english' ? `, ${level}` : ''}
            {t.language && <span className="font-normal text-slate-500"> in {LANGUAGES[t.language]?.label || t.language}</span>}
          </p>
          <p className="mt-0.5 text-xs text-slate-500">
            {[jobTitle ? `For ${jobTitle}` : 'Practice, not for a job', fmt(t.completed_at || t.started_at)].join(' · ')}
          </p>
        </div>
        <div className="text-right">
          {t.band ? (
            <>
              <p className="text-2xl font-bold tabular-nums text-slate-900">{overall ?? '—'}<span className="text-sm text-slate-500">/100</span></p>
              <p className="text-xs text-slate-500">{bandLabel(t.band)}</p>
            </>
          ) : (
            <Badge tone="muted">{t.state === 'in_progress' ? 'In progress' : 'Being marked'}</Badge>
          )}
        </div>
      </div>

      {e && (
        <p className="mt-3 flex flex-wrap items-center gap-2 text-sm text-slate-700">
          English level <span className="font-semibold">{e.cefr || '—'}</span>
          {e.requiredLevel && <span className="text-slate-500">(job needs {e.requiredLevel})</span>}
          {meets && <Badge tone={meets[0]}>{meets[1]}</Badge>}
        </p>
      )}

      {t.summary && <p className="mt-3 text-sm leading-relaxed text-slate-600">{t.summary}</p>}

      {sections.length > 0 && (
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {sections.map((sec) => (
            <div key={sec.key || sec.label} className="rounded-lg bg-slate-50 px-3 py-2">
              <p className="text-[11px] text-slate-500">{sec.label}</p>
              <p className="text-sm font-semibold text-slate-900">{sec.score == null ? 'Not scored' : `${sec.score}/100`}</p>
            </div>
          ))}
        </div>
      )}

      {t.band && (
        <div className="mt-4 text-sm">
          {notes.length === 0 ? (
            <p className="text-slate-600"><span className="font-medium text-emerald-700">Integrity: clear.</span> No notes from full screen, camera, paste or copy checks.</p>
          ) : (
            <>
              <p className="font-medium text-amber-700">Integrity: {notes.length} note{notes.length > 1 ? 's' : ''} to check</p>
              <ul className="mt-1 list-disc space-y-0.5 pl-5 text-xs text-amber-700">
                {notes.map((n) => <li key={n}>{n}</li>)}
              </ul>
            </>
          )}
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-xs">
        <span className="text-slate-500">Camera photos: {t.photos}</span>
        {t.state !== 'in_progress' && (
          <Link href={`/company/assessments/${t.id}`} className="font-medium text-indigo-600 hover:text-indigo-700">Full report, answers and photos →</Link>
        )}
      </div>
    </div>
  )
}

export default async function AdminCandidateDetail({ params }) {
  const { id } = await params
  const { profile, expert, jobs, tests, applied } = await fetchCandidate(id)

  if (!profile) {
    return (
      <div className="max-w-3xl">
        <Link href="/admin/candidates" className="text-sm text-indigo-600 hover:text-indigo-700">← Back to candidates</Link>
        <p className="mt-6 text-slate-500">No candidate found with that id.</p>
      </div>
    )
  }

  const sections = profile.resume_sections || {}
  const personal = sections.personal || {}
  const loc = profile.profile_prefs?.location || {}
  const emailFromInterview = jobs.find((j) => j.email)?.email || personal.email || '—'

  return (
    <div className="max-w-5xl space-y-8">
      <div>
        <Link href="/admin/candidates" className="text-sm text-indigo-600 hover:text-indigo-700">← Back to candidates</Link>
        <h1 className="text-[28px] font-semibold tracking-tight text-slate-900 mt-3">
          {profile.full_name || personal.full_name || 'Unnamed candidate'}
        </h1>
        <p className="text-slate-500 mt-1 text-sm">{emailFromInterview}</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label="Jobs started" value={applied.length} />
        <Stat label="Tests taken" value={tests.length} />
        <Stat label="Expert interviews" value={expert.length} />
        <Stat label="Last active" value={fmt(profile.updated_at)} />
      </div>

      {/* Jobs: is this person a fit, step by step. */}
      <section>
        <h2 className="text-sm font-semibold text-slate-900 mb-3">Jobs and eligibility</h2>
        <VerdictRules />
        {applied.length === 0 ? (
          <Empty>This candidate hasn&apos;t started on any job yet.</Empty>
        ) : (
          <div className="space-y-4">
            {applied
              .map((job) => {
                const forJob = tests.filter((t) => t.job_id === job.id)
                const interview = jobs.find((j) => j.job_id === job.id) || null
                const last = Math.max(0, ...forJob.map((t) => +new Date(t.started_at)), interview ? +new Date(interview.created_at) : 0)
                return { job, forJob, interview, last }
              })
              .sort((a, b) => b.last - a.last)
              .map(({ job, forJob, interview }) => <JobCard key={job.id} job={job} tests={forJob} interview={interview} />)}
          </div>
        )}
      </section>

      {/* Written tests: skills and English. */}
      <section>
        <h2 className="text-sm font-semibold text-slate-900 mb-3">Skills and English tests</h2>
        {tests.length === 0 ? (
          <Empty>This candidate hasn&apos;t taken a skills or English test yet.</Empty>
        ) : (
          <div className="space-y-4">
            {tests.map((t) => <TestCard key={t.id} t={t} jobTitle={applied.find((j) => j.id === t.job_id)?.title} />)}
          </div>
        )}
      </section>

      {/* Profile */}
      <section>
        <h2 className="text-sm font-semibold text-slate-900 mb-3">Profile</h2>
        <div className="rounded-xl border border-slate-200 bg-white divide-y divide-slate-100">
          {[
            ['Phone', profile.profile_prefs?.personal?.phone || personal.phone],
            ['Location', [loc.city || personal.city, loc.country || personal.country].filter(Boolean).join(', ')],
            ['Work authorisation', loc.work_auth],
            ['LinkedIn', profile.linkedin_url],
            ['GitHub', profile.github_url],
            ['Resume file', profile.resume_filename],
            ['Joined', fmt(profile.created_at)],
          ].map(([k, v]) => (
            <div key={k} className="flex gap-4 px-4 py-2.5 text-sm">
              <span className="w-44 shrink-0 text-slate-500">{k}</span>
              <span className="text-slate-800 break-all">{v || '—'}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Expert interviews (Maya) */}
      <section>
        <h2 className="text-sm font-semibold text-slate-900 mb-3">Expert interviews (Maya)</h2>
        {expert.length === 0 ? (
          <Empty>This candidate hasn&apos;t completed an expert interview yet.</Empty>
        ) : (
          <div className="space-y-4">
            {expert.map((a) => (
              <div key={a.id} className="rounded-xl border border-slate-200 bg-white p-5">
                <div className="flex flex-wrap items-baseline justify-between gap-3">
                  <div>
                    <p className="font-semibold text-slate-900">{a.domain || 'Domain interview'}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{fmt(a.created_at)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-slate-900 tabular-nums">
                      {a.expertise_score ?? '—'}<span className="text-sm text-slate-500">/10</span>
                    </p>
                    <p className="text-xs capitalize text-slate-500">{a.expertise_level || 'unrated'}</p>
                  </div>
                </div>

                {a.report?.domain_summary && (
                  <p className="text-sm text-slate-600 mt-3 leading-relaxed">{a.report.domain_summary}</p>
                )}

                {a.report?.internal_scores && (
                  <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {Object.entries(a.report.internal_scores).map(([k, v]) => (
                      <div key={k} className="rounded-lg bg-slate-50 px-3 py-2">
                        <p className="text-[11px] text-slate-500 capitalize">{k.replace(/_/g, ' ')}</p>
                        <p className="text-sm font-semibold text-slate-900">{v}/10</p>
                      </div>
                    ))}
                  </div>
                )}

                {a.report?.eie && <div className="mt-4"><EieProfile eie={a.report.eie} /></div>}

                {/* The actual conversation. Scores without the exchange behind
                    them can't be sanity-checked — an admin needs to see what was
                    asked and what came back, including where nothing came back. */}
                <Transcript turns={a.transcript} />
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Job interviews (Iris) */}
      <section>
        <h2 className="text-sm font-semibold text-slate-900 mb-3">Job interviews (Iris)</h2>
        {jobs.length === 0 ? (
          <Empty>This candidate hasn&apos;t interviewed for a role yet.</Empty>
        ) : (
          <div className="space-y-4">
            {jobs.map((j) => (
              <div key={j.id} className="rounded-xl border border-slate-200 bg-white p-5">
                <div className="flex flex-wrap items-baseline justify-between gap-3">
                  <div>
                    <p className="font-semibold text-slate-900">{j.job_title || 'Role'}</p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {[j.company, fmt(j.created_at)].filter(Boolean).join(' · ')}
                    </p>
                  </div>
                  <div className="text-right">
                    {j.report?.score != null && (
                      <p className="text-2xl font-bold text-slate-900 tabular-nums">
                        {j.report.score}<span className="text-sm text-slate-500">/10</span>
                      </p>
                    )}
                    {j.job_fit_score != null && (
                      <p className="text-xs text-slate-500">{j.job_fit_score}% fit for this role</p>
                    )}
                  </div>
                </div>

                {j.report?.summary && (
                  <p className="text-sm text-slate-600 mt-3 leading-relaxed">{j.report.summary}</p>
                )}
                {j.fit_reasoning && (
                  <p className="text-xs text-slate-500 mt-2 italic">{j.fit_reasoning}</p>
                )}

                {Array.isArray(j.report?.rubric) && j.report.rubric.length > 0 && (
                  <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {j.report.rubric.map((r, i) => (
                      <div key={i} className="rounded-lg bg-slate-50 px-3 py-2">
                        <div className="flex justify-between gap-2">
                          <p className="text-[11px] font-medium text-slate-700">{r.skill}</p>
                          <p className="text-[11px] font-semibold text-slate-900">{r.score == null ? 'Not assessed' : `${r.score}/10`}</p>
                        </div>
                        {evidenceText(r.evidence) && <p className="text-[11px] text-slate-500 mt-1 line-clamp-2">{evidenceText(r.evidence)}</p>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
