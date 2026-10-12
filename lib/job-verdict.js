// Is a candidate a fit for a job? One plain verdict from the job's steps: its
// skills test, its English test and the AI interview, plus the tests'
// integrity notes. It only advises: JobStream never rejects anyone on its own,
// and the hiring decision is always made by a person.
//
//   Not a fit yet  any step is below the bar (skills "Not yet", English below
//                  the required level, interview "no")
//   Not finished   nothing is below the bar, but a step is missing or marking
//   Consider       everything is done, but something is borderline or the
//                  tests have integrity notes to check
//   Recommended    everything is done and every step clears the bar

import { BANDS, TRACKS, trackFromRoleFamily } from './assessment-blueprint.js'

export const VERDICTS = Object.freeze({
  recommended: { label: 'Recommended', tone: 'good' },
  consider: { label: 'Consider', tone: 'warn' },
  not_fit: { label: 'Not a fit yet', tone: 'bad' },
  incomplete: { label: 'Not finished', tone: 'muted' },
})

const BAND_STATUS = { strong: 'pass', good: 'pass', borderline: 'borderline', not_yet: 'fail' }
const MEETS_STATUS = { yes: 'pass', borderline: 'borderline', no: 'fail' }
const INTERVIEW_STATUS = { strong_yes: 'pass', yes: 'pass', maybe: 'borderline', no: 'fail' }
const INTERVIEW_LABEL = { strong_yes: 'Strong yes', yes: 'Yes', maybe: 'Maybe', no: 'No' }

export const bandLabel = (key) => BANDS.find((b) => b.key === key)?.label || null
export const trackLabel = (track) => TRACKS[track]?.label || track || 'Test'

// The track a session was for (older sessions only have role_family).
export const sessionTrack = (s) => s.track || trackFromRoleFamily(s.role_family)

// What a job asks for: its main test, an English level, and the interview.
export function jobRequirements(job) {
  const cfg = job.assessment_config
  const legacy = (job.required_assessments || []).map(trackFromRoleFamily).find((t) => TRACKS[t]?.available)
  const track = cfg?.track || legacy || null
  const englishLevel = track === 'english'
    ? (cfg?.options?.requiredLevel || 'B2')
    : (cfg?.english?.requiredLevel || null)
  return { track, englishLevel, interview: job.requires_ai_interview !== false }
}

// The latest attempt at a test, as one step.
function testStep(kind, label, attempt, judge) {
  if (!attempt) return { kind, label, status: 'missing', detail: 'Not taken yet' }
  if (attempt.state === 'in_progress') return { kind, label, status: 'missing', detail: 'Started, not finished', sessionId: attempt.id }
  if (!attempt.band) return { kind, label, status: 'marking', detail: 'Being marked', sessionId: attempt.id }
  return { kind, label, sessionId: attempt.id, ...judge(attempt) }
}

const score = (a) => (a.overall_score == null ? null : Math.round(a.overall_score * 10))

// tests: this candidate's attempts for this job, newest first (assessment
// sessions joined to their reports). interview: their Iris interview for this
// job, or null.
export function jobSteps(job, tests = [], interview = null) {
  const req = jobRequirements(job)
  const steps = []
  const latest = (track) => tests.find((t) => sessionTrack(t) === track)

  if (req.track && req.track !== 'english') {
    steps.push(testStep('skills', `Skills test: ${trackLabel(req.track)}`, latest(req.track), (a) => ({
      status: BAND_STATUS[a.band] || 'borderline',
      detail: `${score(a) ?? '?'}/100, ${bandLabel(a.band) || a.band}`,
    })))
  }
  if (req.englishLevel) {
    steps.push(testStep('english', `English (needs ${req.englishLevel})`, latest('english'), (a) => {
      const e = a.english || {}
      return {
        status: MEETS_STATUS[e.meetsRequired] || BAND_STATUS[a.band] || 'borderline',
        detail: [e.cefr && `Level ${e.cefr}`, e.overall != null && `${e.overall}/100`].filter(Boolean).join(', ') || `${score(a) ?? '?'}/100`,
      }
    }))
  }
  if (req.interview || interview) {
    const rec = interview?.report?.recommendation
    steps.push({
      kind: 'interview',
      label: 'AI interview (Iris)',
      ...(!interview ? { status: 'missing', detail: 'Not taken yet' }
        : !rec ? { status: 'marking', detail: 'No report yet' }
          : { status: INTERVIEW_STATUS[rec] || 'borderline', detail: `${INTERVIEW_LABEL[rec] || rec}${interview.report.score != null ? `, ${interview.report.score}/10` : ''}` }),
    })
  }

  // Integrity notes are a reason to look closer, never a reason to reject.
  const finished = tests.filter((t) => t.band)
  if (finished.length) {
    const notes = finished.flatMap((t) => (t.integrity?.level === 'review' ? t.integrity.notes || [] : []))
    steps.push({
      kind: 'integrity',
      label: 'Test integrity',
      status: notes.length ? 'borderline' : 'pass',
      detail: notes.length ? `${notes.length} note${notes.length > 1 ? 's' : ''} to check` : 'No notes',
      notes,
    })
  }
  return steps
}

export function verdictFor(steps) {
  const has = (s) => steps.some((x) => x.status === s)
  const key = steps.length === 0 || (!has('fail') && (has('missing') || has('marking'))) ? 'incomplete'
    : has('fail') ? 'not_fit'
      : has('borderline') ? 'consider'
        : 'recommended'
  const reasons = {
    not_fit: steps.filter((x) => x.status === 'fail').map((x) => x.label),
    incomplete: steps.filter((x) => x.status === 'missing' || x.status === 'marking').map((x) => x.label),
    consider: steps.filter((x) => x.status === 'borderline').map((x) => x.label),
    recommended: [],
  }[key]
  return { key, ...VERDICTS[key], reasons }
}
