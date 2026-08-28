import Link from 'next/link'
import { query } from '@/lib/db'
import EieProfile from '@/components/EieProfile'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Candidate — JobStream Admin' }

// Everything we hold on one candidate, in one place: who they are, what we read
// off their resume, and every assessment they've completed. Previously the admin
// list had no detail view at all — you could see that someone had interviewed,
// but not what they said or how they scored.
async function fetchCandidate(userId) {
  const [profile, expert, jobs] = await Promise.all([
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
      `SELECT ic.id, ic.name, ic.email, ic.job_fit_score, ic.fit_reasoning, ic.decision,
              ic.report, ic.created_at, j.title AS job_title, j.company
       FROM interview_candidates ic
       LEFT JOIN interview_jobs j ON j.id = ic.job_id
       WHERE ic.user_id = $1
       ORDER BY ic.created_at DESC`, [userId]
    ).catch(() => ({ rows: [] })),
  ])
  return { profile: profile.rows?.[0] || null, expert: expert.rows || [], jobs: jobs.rows || [] }
}

const fmt = (d) => (d ? new Date(d).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' }) : '—')

function Stat({ label, value }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <p className="text-xs text-slate-400">{label}</p>
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
    return <p className="text-xs text-slate-400 mt-4">No transcript recorded.</p>
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

export default async function AdminCandidateDetail({ params }) {
  const { id } = await params
  const { profile, expert, jobs } = await fetchCandidate(id)

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
        <Stat label="Expert interviews" value={expert.length} />
        <Stat label="Job interviews" value={jobs.length} />
        <Stat label="Resume" value={profile.resume_filename ? `${profile.resume_pages || '?'} pages` : 'None'} />
        <Stat label="Last active" value={fmt(profile.updated_at)} />
      </div>

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
                    <p className="text-xs text-slate-400 mt-0.5">{fmt(a.created_at)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-slate-900 tabular-nums">
                      {a.expertise_score ?? '—'}<span className="text-sm text-slate-400">/10</span>
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
                    <p className="text-xs text-slate-400 mt-0.5">
                      {[j.company, fmt(j.created_at)].filter(Boolean).join(' · ')}
                    </p>
                  </div>
                  <div className="text-right">
                    {j.report?.score != null && (
                      <p className="text-2xl font-bold text-slate-900 tabular-nums">
                        {j.report.score}<span className="text-sm text-slate-400">/10</span>
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
                          <p className="text-[11px] font-semibold text-slate-900">{r.score}/10</p>
                        </div>
                        {r.evidence && <p className="text-[11px] text-slate-500 mt-1 line-clamp-2">{r.evidence}</p>}
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
