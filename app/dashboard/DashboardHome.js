'use client'

import { useState } from 'react'
import { interviewLengthLabel } from '@/lib/interview-config'
import Link from 'next/link'

const REC_LABEL = { strong_yes: 'Strong Yes', yes: 'Yes', maybe: 'Maybe', no: 'No' }

function fmtDate(d) {
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export default function DashboardHome({ firstName, fullName, email, hasResume, interviews, applications, expertAssessments = [] }) {
  const [tab, setTab] = useState('interviews')

  // ── Pending tasks (dynamic, based on candidate state) ──────────────────────
  const tasks = []
  if (!hasResume) {
    tasks.push({
      key: 'resume',
      title: 'Upload your resume',
      desc: 'Add your resume so Iris and Maya can tailor your interviews.',
      href: '/dashboard/profile?tab=resume',
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6M12 18v-6M9 15h6" />
        </svg>
      ),
    })
  }
  if (hasResume && expertAssessments.length === 0) {
    tasks.push({
      key: 'expert',
      title: 'Take your Expert Interview',
      desc: `A ${interviewLengthLabel} voice interview with Maya to verify your expertise.`,
      href: '/dashboard/domain-expert',
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 2a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z" /><path d="M19 10v1a7 7 0 0 1-14 0v-1M12 18v4M8 22h8" />
        </svg>
      ),
    })
  }
  if (!fullName) {
    tasks.push({
      key: 'profile',
      title: 'Complete your profile',
      desc: 'Add your name and details so companies know who you are.',
      href: '/dashboard/profile',
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
        </svg>
      ),
    })
  }

  // Status banner content
  const banner = !hasResume
    ? { text: 'Finish setting up your profile', accent: "Upload your resume to unlock interviews", href: '/dashboard/profile?tab=resume', cta: 'Complete setup' }
    : interviews.length === 0
    ? { text: 'You’re ready to go', accent: 'Take your Expert Interview or apply to a role', href: '/jobs', cta: 'Browse roles' }
    : { text: 'All set', accent: 'Keep applying to strengthen your profile', href: '/jobs', cta: 'Browse roles' }

  return (
    <div className="max-w-5xl mx-auto">
      {/* Status banner */}
      <Link
        href={banner.href}
        className="group flex items-center justify-between gap-4 px-5 py-4 mb-8 rounded-2xl border border-slate-200/80 bg-white hover:border-slate-300 hover:shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_24px_-16px_rgba(15,23,42,0.2)] transition"
      >
        <p className="text-sm text-slate-600 flex items-center gap-2.5 min-w-0">
          <span className="relative flex h-2 w-2 flex-shrink-0">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-60" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-500" />
          </span>
          <span className="font-semibold text-slate-900">{banner.text}</span>
          <span className="text-slate-400 hidden sm:inline">·</span>
          <span className="text-slate-500 truncate hidden sm:inline">{banner.accent}</span>
        </p>
        <span className="inline-flex items-center gap-1 text-sm font-semibold text-slate-900 whitespace-nowrap flex-shrink-0">
          {banner.cta}
          <svg className="text-slate-300 group-hover:translate-x-0.5 group-hover:text-slate-500 transition" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6" /></svg>
        </span>
      </Link>

      {/* Welcome header */}
      <div className="flex items-start justify-between gap-4 mb-10">
        <h1 className="text-3xl sm:text-4xl font-bold text-slate-900 tracking-tight">
          Welcome back{firstName ? `, ${firstName}` : ''}
        </h1>
        <Link
          href="/dashboard/domain-expert"
          className="hidden sm:inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition whitespace-nowrap"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z" /><path d="M19 10v1a7 7 0 0 1-14 0v-1" /></svg>
          Expert Interview
        </Link>
      </div>

      {/* Pending tasks */}
      {tasks.length > 0 && (
        <div className="mb-10">
          <div className="flex items-center gap-2.5 mb-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.13em] text-slate-400">Pending Tasks</p>
            <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-slate-900 text-white text-[10px] font-semibold flex items-center justify-center">{tasks.length}</span>
          </div>
          <div className="space-y-3">
            {tasks.map((t) => (
              <Link
                key={t.key}
                href={t.href}
                className="group flex items-center gap-4 px-5 py-4 rounded-2xl border border-slate-200/80 bg-white hover:border-slate-300 hover:shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_24px_-16px_rgba(15,23,42,0.2)] transition"
              >
                <span className="w-11 h-11 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center flex-shrink-0 group-hover:bg-indigo-50 group-hover:text-indigo-600 transition-colors">{t.icon}</span>
                <span className="flex-1 min-w-0">
                  <span className="block font-semibold text-slate-900">{t.title}</span>
                  <span className="block text-sm text-slate-500 mt-0.5">{t.desc}</span>
                </span>
                <svg className="text-slate-300 group-hover:text-slate-500 transition" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6" /></svg>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="inline-flex items-center gap-1 p-1 rounded-full bg-slate-100 mb-6">
        {[
          { key: 'interviews', label: 'Interviews' },
          { key: 'applications', label: 'Applications' },
        ].map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-5 py-2 rounded-full text-sm font-semibold transition ${
              tab === t.key ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === 'interviews' ? (
        <Section title="Your interviews" count={interviews.length + expertAssessments.length}>
          {interviews.length === 0 && expertAssessments.length === 0 ? (
            <div className="space-y-4">
              <EmptyState
                text="You haven't completed any interviews yet."
                ctaText="Take your Expert Interview with Maya"
                href="/dashboard/domain-expert"
              />
              <p className="text-center text-sm text-slate-400">
                or <Link href="/jobs" className="text-indigo-600 font-semibold hover:underline">apply to a role</Link> to interview with Iris
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Expert (Maya) interviews */}
              {expertAssessments.map((ea) => (
                <div key={ea.id} className="group rounded-2xl border border-slate-200/80 bg-white p-5 hover:border-slate-300 hover:shadow-[0_1px_2px_rgba(15,23,42,0.04),0_12px_28px_-18px_rgba(15,23,42,0.25)] transition-all">
                  <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-400 mb-2">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z"/><path d="M19 10v1a7 7 0 0 1-14 0v-1"/></svg>
                    Expert · Maya
                  </span>
                  <p className="font-semibold text-slate-900">{ea.domain || 'Domain Expertise'}</p>
                  <p className="text-sm text-slate-500 mt-0.5">{fmtDate(ea.createdAt)}</p>
                  <div className="flex items-center gap-2.5 mt-4">
                    {ea.score != null && <span className="text-sm font-semibold text-slate-900">{ea.score}<span className="text-slate-400">/10</span></span>}
                    {ea.level && (
                      <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 capitalize">{ea.level}</span>
                    )}
                  </div>
                </div>
              ))}

              {/* Job (Iris) interviews */}
              {interviews.map((iv) => (
                <div key={iv.id} className="group rounded-2xl border border-slate-200/80 bg-white p-5 hover:border-slate-300 hover:shadow-[0_1px_2px_rgba(15,23,42,0.04),0_12px_28px_-18px_rgba(15,23,42,0.25)] transition-all">
                  <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-400 mb-2">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                    Job · Iris
                  </span>
                  <p className="font-semibold text-slate-900">{iv.jobTitle || 'Interview'}</p>
                  <p className="text-sm text-slate-500 mt-0.5">{iv.jobRole ? `${iv.jobRole} · ` : ''}{fmtDate(iv.createdAt)}</p>
                  <div className="flex items-center gap-2.5 mt-4">
                    {iv.score != null && <span className="text-sm font-semibold text-slate-900">{iv.score}<span className="text-slate-400">/10</span></span>}
                    {iv.recommendation && (
                      <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                        {REC_LABEL[iv.recommendation] || iv.recommendation}
                      </span>
                    )}
                    {iv.jobFit != null && <span className="text-xs text-slate-400">Fit {iv.jobFit}%</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Section>
      ) : (
        <Section title="Your applications" count={applications.length}>
          {applications.length === 0 ? (
            <EmptyState text="No applications yet." ctaText="Find a role to apply to" href="/jobs" />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {applications.map((a) => (
                <Link key={a.id} href={`/interview/${a.jobSlug}`} className="rounded-2xl border border-slate-200/80 bg-white p-5 hover:border-slate-300 hover:shadow-[0_1px_2px_rgba(15,23,42,0.04),0_12px_28px_-18px_rgba(15,23,42,0.25)] transition block">
                  <p className="font-semibold text-slate-900">{a.jobTitle || 'Application'}</p>
                  <p className="text-sm text-slate-500 mt-0.5">{a.jobRole ? `${a.jobRole} · ` : ''}{fmtDate(a.createdAt)}</p>
                  <span className={`inline-flex items-center gap-1.5 mt-4 text-[11px] font-medium px-2.5 py-1 rounded-full ${
                    a.status === 'submitted' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
                  }`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${a.status === 'submitted' ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                    {a.status === 'submitted' ? 'Submitted' : 'In progress'}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </Section>
      )}
    </div>
  )
}

function Section({ title, count, children }) {
  return (
    <div>
      <h2 className="text-xl font-bold text-slate-900 mb-4">
        {title} <span className="text-slate-400 font-medium">({count})</span>
      </h2>
      {children}
    </div>
  )
}

function EmptyState({ text, ctaText, href }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50/50 px-6 py-14 text-center">
      <p className="text-slate-500 mb-3">{text}</p>
      <Link href={href} className="text-sm font-bold text-indigo-600 hover:text-indigo-700 underline underline-offset-4">
        {ctaText} →
      </Link>
    </div>
  )
}
