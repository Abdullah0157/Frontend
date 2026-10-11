'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import LoadingState from '../components/LoadingState'
import { getSupabaseBrowser } from '@/lib/supabase/client'

// Home page (design option A, "clear and calm"). Speaks to companies first
// (they pay), with a clear path for candidates. Everything shown is real:
// the report card is labelled as a sample.

const STEPS = [
  { n: '01', title: 'Post a job', text: 'JobStream suggests the right test for the role. Add the English test for customer-facing jobs.' },
  { n: '02', title: 'Candidates show what they can do', text: 'A timed skills test, then a short AI interview with Iris, from any computer.' },
  { n: '03', title: 'You decide with evidence', text: 'Scores, recordings, resume checks and follow-up questions in one report.' },
]

const TESTS = [
  { name: 'Backend developer', detail: 'Coding in JavaScript, TypeScript or Python' },
  { name: 'Frontend developer', detail: 'JavaScript and TypeScript' },
  { name: 'Full stack developer', detail: 'Both sides, one test' },
  { name: 'Customer service agent', detail: 'Typing, situations, written replies' },
  { name: 'English level', detail: 'Listening, speaking, reading, on the CEFR scale' },
  { name: 'General workplace', detail: 'Judgement, numbers, detail, writing' },
]

const FAIRNESS = [
  { title: 'Accent is never scored', text: 'The English test judges whether someone is easy to understand, not where they are from.' },
  { title: 'No copy and paste', text: 'Questions cannot be copied out, answers cannot be pasted in, and the test runs in full screen.' },
  { title: 'People decide', text: 'JobStream never rejects anyone on its own. Unusual signals are notes for your team to ask about.' },
]

const SAMPLE_SCORES = [
  { label: 'Typing', value: '74 wpm · 98%', pct: 88 },
  { label: 'Customer situations', value: '85', pct: 85 },
  { label: 'Written reply', value: '78', pct: 78 },
]

const primaryBtn = 'inline-flex items-center justify-center rounded-xl bg-brand px-6 py-3.5 font-semibold text-white hover:bg-brand-dark transition-colors'
const secondaryBtn = 'inline-flex items-center justify-center rounded-xl border border-[#CDD2DA] bg-white px-6 py-3.5 font-semibold text-ink hover:bg-surface transition-colors'

export default function LandingPage() {
  const [isMatching, setIsMatching] = useState(false)
  const router = useRouter()

  // Routes the user through auth + onboarding before showing matched jobs.
  // - Not logged in        → /login (then comes back here for onboarding/match)
  // - Logged in, no resume → /profile?onboarding=1 (then auto-routes to /jobs)
  // - Logged in, resume    → /jobs (already personalized via /api/jobs/matched)
  async function handleAiMatch() {
    setIsMatching(true)
    try {
      const supabase = getSupabaseBrowser()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login?next=/jobs')
        return
      }
      const res = await fetch('/api/profile', { cache: 'no-store' })
      const data = res.ok ? await res.json() : null
      const hasResume = !!data?.profile?.has_resume
      router.push(hasResume ? '/jobs' : '/profile?onboarding=1&next=/jobs')
    } catch (e) {
      console.error('AI match routing failed', e)
      router.push('/login?next=/jobs')
    }
  }

  return (
    <div className="bg-white pt-16 text-ink">
      {isMatching && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-white/80 backdrop-blur-xl">
          <LoadingState message="Finding jobs that match you" />
        </div>
      )}

      {/* Hero */}
      <section className="mx-auto flex max-w-[1200px] flex-wrap items-center gap-14 px-6 pb-24 pt-16 md:pt-24">
        <div className="min-w-0 flex-[1_1_460px]">
          <p className="mb-4 text-sm font-semibold text-brand">Skills tests and AI interviews for hiring</p>
          <h1 className="mb-6 text-[44px] font-bold leading-[1.04] tracking-[-0.03em] md:text-[60px]">Hire on proof, not on paper.</h1>
          <p className="mb-9 max-w-[520px] text-lg text-body md:text-[19px]">
            Every job you post gets a skills test matched to the role and a short AI interview. You get a scored report with the evidence behind every number.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link href="/signup/company" className={primaryBtn}>Post a job</Link>
            <Link href="#candidates" className={secondaryBtn}>I am looking for work</Link>
          </div>
        </div>

        <div className="min-w-0 flex-[1_1_440px]">
          <div className="overflow-hidden rounded-[18px] border border-line bg-white shadow-[0_24px_60px_rgba(14,17,22,0.10)]">
            <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-4">
              <div>
                <div className="text-[13px] text-muted">Candidate report · Customer service agent</div>
                <div className="text-[17px] font-semibold">Candidate A</div>
              </div>
              <span className="shrink-0 whitespace-nowrap rounded-full bg-[#F2F3F5] px-2.5 py-1 text-xs font-semibold text-muted">Sample report</span>
            </div>
            <div className="flex flex-wrap gap-6 p-5">
              <div className="flex flex-col items-start gap-1.5">
                <div className="font-mono text-[46px] leading-none">82</div>
                <div className="text-[13px] text-muted">out of 100</div>
                <span className="rounded-full bg-[#DDF5E7] px-2.5 py-1 text-[13px] font-semibold text-[#0F5132]">Strong</span>
              </div>
              <div className="flex min-w-[220px] flex-1 flex-col gap-3 text-sm">
                {SAMPLE_SCORES.map((s) => (
                  <div key={s.label}>
                    <div className="flex justify-between"><span>{s.label}</span><span className="font-mono">{s.value}</span></div>
                    <div className="mt-1.5 h-1.5 rounded-full bg-[#EEF0F3]"><div className="h-1.5 rounded-full bg-brand" style={{ width: `${s.pct}%` }} /></div>
                  </div>
                ))}
                <div className="flex items-center justify-between"><span>English</span><span className="font-semibold">B2 · meets the job&apos;s level</span></div>
              </div>
            </div>
            <div className="flex flex-col gap-2.5 px-5 pb-5 text-sm">
              <div className="flex items-center gap-3 rounded-xl bg-surface px-3.5 py-3">
                <span className="inline-flex h-[34px] w-[34px] flex-none items-center justify-center rounded-full bg-brand" aria-hidden="true">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="#FFFFFF"><path d="M8 5v14l11-7z" /></svg>
                </span>
                <span className="flex-1">Role-play: upset customer, late parcel</span>
                <span className="font-mono text-muted">0:52</span>
              </div>
              <div className="rounded-xl bg-surface px-3.5 py-3">
                <div className="mb-1 font-semibold">Ask in the interview</div>
                <div className="text-body">&ldquo;Your resume says you handled refunds. Walk me through the last one that went wrong.&rdquo;</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="companies" className="scroll-mt-16 border-y border-line bg-surface">
        <div className="mx-auto max-w-[1200px] px-6 py-20 md:py-24">
          <h2 className="mb-3 text-[32px] font-bold tracking-[-0.02em] md:text-[38px]">How it works</h2>
          <p className="mb-11 max-w-[620px] text-lg text-body">Three steps, and every decision stays with your team.</p>
          <ol className="flex flex-wrap gap-5">
            {STEPS.map((s) => (
              <li key={s.n} className="flex-[1_1_300px] rounded-2xl border border-line bg-white p-7">
                <div className="mb-3.5 font-mono text-sm text-brand">{s.n}</div>
                <h3 className="mb-2 text-xl font-semibold">{s.title}</h3>
                <p className="text-body">{s.text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Tests */}
      <section id="tests" className="mx-auto flex max-w-[1200px] scroll-mt-16 flex-wrap gap-12 px-6 py-20 md:py-24">
        <div className="flex-[1_1_340px]">
          <h2 className="mb-3 text-[32px] font-bold tracking-[-0.02em] md:text-[38px]">Tests ready today</h2>
          <p className="text-lg text-body">Every candidate gets a different set of questions, timed and marked the same way. Jobs in other fields get the General workplace test while their own is built.</p>
        </div>
        <ul className="flex flex-[2_1_560px] flex-wrap gap-3.5">
          {TESTS.map((t) => (
            <li key={t.name} className="flex-[1_1_250px] rounded-[14px] border border-line px-5 py-[18px]">
              <div className="font-semibold">{t.name}</div>
              <div className="text-sm text-muted">{t.detail}</div>
            </li>
          ))}
        </ul>
      </section>

      {/* Fairness */}
      <section className="bg-ink text-[#F4F5F7]">
        <div className="mx-auto max-w-[1200px] px-6 py-20 md:py-24">
          <h2 className="mb-10 max-w-[640px] text-[32px] font-bold tracking-[-0.02em] md:text-[38px]">Fair to every candidate, hard to cheat.</h2>
          <div className="flex flex-wrap gap-7">
            {FAIRNESS.map((f) => (
              <div key={f.title} className="flex-[1_1_240px]">
                <h3 className="mb-2 text-lg font-semibold">{f.title}</h3>
                <p className="text-[#B8BDC8]">{f.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Candidates */}
      <section id="candidates" className="mx-auto flex max-w-[1200px] scroll-mt-16 flex-wrap items-center gap-10 px-6 py-20 md:py-24">
        <div className="flex-[1_1_460px]">
          <h2 className="mb-3 text-[32px] font-bold tracking-[-0.02em] md:text-[38px]">Looking for work?</h2>
          <p className="mb-7 max-w-[540px] text-lg text-body">
            Show your skills, not just your CV. Applying is free: pick a job, take its test and a short interview, and the company sees what you can really do.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link href="/jobs" className="inline-flex items-center justify-center rounded-xl bg-ink px-6 py-3.5 font-semibold text-white hover:bg-[#262B33] transition-colors">Browse jobs</Link>
            <button type="button" onClick={handleAiMatch} disabled={isMatching} className={secondaryBtn}>Match my CV to jobs</button>
          </div>
        </div>
        <div className="flex-[1_1_380px] rounded-[18px] bg-brand-soft p-8">
          <ul className="flex list-disc flex-col gap-3 pl-5 text-[#1E2230]">
            <li>Free for candidates</li>
            <li>Take it from home, on any computer</li>
            <li>One fair attempt per job</li>
            <li>Your skills, matched to open roles</li>
          </ul>
        </div>
      </section>

      {/* Call to action */}
      <section className="mx-auto max-w-[1200px] px-6 pb-24">
        <div className="flex flex-wrap items-center justify-between gap-6 rounded-[22px] bg-brand px-8 py-12 text-white md:px-10 md:py-14">
          <div className="flex-[1_1_420px]">
            <h2 className="mb-2 text-[28px] font-bold tracking-[-0.02em] md:text-[34px]">See the evidence before the interview.</h2>
            <p className="text-[#E3E5FF]">Post your first job and invite candidates today.</p>
          </div>
          <Link href="/signup/company" className="inline-flex items-center justify-center rounded-xl bg-white px-6 py-3.5 font-semibold text-brand-deep hover:bg-brand-soft transition-colors">Create a company account</Link>
        </div>
      </section>
    </div>
  )
}
