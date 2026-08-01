'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import SkillRadar from './SkillRadar'

const DOMAIN_COLORS = {
  engineering: 'from-indigo-500 to-blue-600',
  product:     'from-purple-500 to-pink-600',
  sales:       'from-amber-500 to-orange-600',
  behavioral:  'from-emerald-500 to-teal-600',
}

const DOMAIN_BAR_COLORS = {
  engineering: 'bg-indigo-500',
  product:     'bg-purple-500',
  sales:       'bg-amber-500',
  behavioral:  'bg-emerald-500',
}

const DOMAIN_LABELS = {
  engineering: 'Engineering',
  product:     'Product',
  sales:       'Sales',
  behavioral:  'Behavioral',
}

// theta is roughly -3..+3 with a prior of 0 — map onto a 0..100 proficiency bar.
function thetaToPct(theta) {
  const t = typeof theta === 'number' ? theta : parseFloat(theta) || 0
  return Math.max(0, Math.min(100, Math.round(((t + 3) / 6) * 100)))
}

function confidenceLabel(confidence) {
  const c = typeof confidence === 'number' ? confidence : parseFloat(confidence) || 0
  if (c >= 0.67) return { text: 'High confidence', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' }
  if (c >= 0.34) return { text: 'Medium confidence', cls: 'bg-amber-50 text-amber-700 border-amber-200' }
  return { text: 'Low confidence', cls: 'bg-slate-100 text-slate-500 border-slate-200' }
}

const EVIDENCE_BADGE = {
  default: 'bg-indigo-50 text-indigo-700 border-indigo-200',
}

export default function SkillProfilePage({ embedded = false }) {
  const [loading, setLoading] = useState(true)
  const [loggedIn, setLoggedIn] = useState(false)
  const [skills, setSkills] = useState([])
  const [evidence, setEvidence] = useState([])
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const meRes = await fetch('/api/me')
        const me = await meRes.json()
        if (cancelled) return
        const isLoggedIn = !!me?.user
        setLoggedIn(isLoggedIn)

        if (!isLoggedIn) {
          setLoading(false)
          return
        }

        const graphRes = await fetch('/api/skill-graph')
        const graph = await graphRes.json()
        if (cancelled) return
        setSkills(graph?.skills || [])
        setEvidence(graph?.evidence || [])
      } catch (e) {
        if (!cancelled) setError('Could not load your skill profile right now.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [])

  const grouped = useMemo(() => {
    const g = {}
    for (const row of skills) {
      const d = row.domain || 'other'
      g[d] ??= []
      g[d].push(row)
    }
    return g
  }, [skills])

  const topDomain = useMemo(() => {
    const entries = Object.entries(grouped)
    if (!entries.length) return null
    entries.sort((a, b) => {
      const avgA = a[1].reduce((s, r) => s + (parseFloat(r.theta) || 0), 0) / a[1].length
      const avgB = b[1].reduce((s, r) => s + (parseFloat(r.theta) || 0), 0) / b[1].length
      return avgB - avgA
    })
    return entries[0][0]
  }, [grouped])

  const radarData = useMemo(() => {
    if (!topDomain) return []
    return grouped[topDomain].map((s) => ({
      label: s.label,
      value: thetaToPct(s.theta),
    }))
  }, [grouped, topDomain])

  return (
    <div className={embedded ? '' : 'min-h-screen pt-32 pb-24 px-4'}>
      <div className={embedded ? 'max-w-5xl mx-auto' : 'container mx-auto max-w-5xl'}>
        <div className="mb-10">
          <p className="text-xs font-black uppercase tracking-widest text-indigo-600 mb-2">Candidate Profile</p>
          <h1 className="text-3xl md:text-4xl font-black uppercase tracking-tight text-slate-900">Skill Profile</h1>
          <p className="text-slate-500 mt-2 max-w-2xl">
            Your persistent skill graph — built up across every assessment and interview you take.
          </p>
        </div>

        {loading && (
          <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center shadow-sm">
            <p className="text-slate-500">Loading your skill profile…</p>
          </div>
        )}

        {!loading && !loggedIn && (
          <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center max-w-xl mx-auto shadow-sm">
            <div className="w-14 h-14 rounded-2xl bg-indigo-50 border border-indigo-200 flex items-center justify-center mx-auto mb-5">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-indigo-600">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
            </div>
            <h2 className="text-xl font-black uppercase tracking-widest text-slate-900 mb-2">Log in to see your skill profile</h2>
            <p className="text-slate-500 mb-6">
              Your skill graph is tied to your candidate account. Log in to view it.
            </p>
            <Link
              href={`/login?next=${encodeURIComponent('/skill-profile')}`}
              className="inline-block px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-black uppercase tracking-widest text-sm transition-colors"
            >
              Log in
            </Link>
          </div>
        )}

        {!loading && loggedIn && !error && skills.length === 0 && (
          <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center max-w-xl mx-auto shadow-sm">
            <div className="w-14 h-14 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-center mx-auto mb-5">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-600">
                <path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z" />
              </svg>
            </div>
            <h2 className="text-xl font-black uppercase tracking-widest text-slate-900 mb-2">No skill data yet</h2>
            <p className="text-slate-500 mb-6">
              Take an assessment to start building your skill profile.
            </p>
            <Link
              href="/assessment"
              className="inline-block px-6 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black uppercase tracking-widest text-sm transition-colors"
            >
              Take an assessment
            </Link>
          </div>
        )}

        {!loading && error && (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-6 text-center text-red-600">
            {error}
          </div>
        )}

        {!loading && loggedIn && !error && skills.length > 0 && (
          <div className="space-y-10">
            {/* Radar chart for the strongest domain */}
            {topDomain && (
              <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
                <div className="flex items-center gap-3 mb-4">
                  <div className={`w-2 h-8 rounded bg-gradient-to-b ${DOMAIN_COLORS[topDomain] || 'from-slate-400 to-slate-600'}`} />
                  <div>
                    <h2 className="text-lg font-black uppercase tracking-widest text-slate-900">
                      {DOMAIN_LABELS[topDomain] || topDomain} at a glance
                    </h2>
                    <p className="text-xs text-slate-500">Your strongest domain, plotted skill by skill</p>
                  </div>
                </div>
                <SkillRadar data={radarData} />
              </div>
            )}

            {/* Skill groups by domain */}
            {Object.entries(grouped).map(([domain, domainSkills]) => (
              <div key={domain}>
                <div className="flex items-center gap-3 mb-4">
                  <div className={`w-2 h-8 rounded bg-gradient-to-b ${DOMAIN_COLORS[domain] || 'from-slate-400 to-slate-600'}`} />
                  <h2 className="text-lg font-black uppercase tracking-widest text-slate-900">
                    {DOMAIN_LABELS[domain] || domain}
                  </h2>
                  <span className="text-xs font-black uppercase tracking-widest text-slate-400">
                    {domainSkills.length} {domainSkills.length === 1 ? 'skill' : 'skills'}
                  </span>
                </div>

                <div className="bg-white border border-slate-200 rounded-2xl divide-y divide-slate-100 shadow-sm">
                  {domainSkills.map((s) => {
                    const pct = thetaToPct(s.theta)
                    const conf = confidenceLabel(s.confidence)
                    return (
                      <div key={s.skill_code} className="p-5 flex flex-col md:flex-row md:items-center gap-3">
                        <div className="md:w-56 shrink-0">
                          <p className="text-sm font-semibold text-slate-900">{s.label}</p>
                          {s.subdomain && (
                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mt-0.5">
                              {s.subdomain.replace(/_/g, ' ')}
                            </p>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="w-full h-2.5 rounded-full bg-slate-100 overflow-hidden">
                            <div
                              className={`h-full rounded-full ${DOMAIN_BAR_COLORS[domain] || 'bg-slate-400'}`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-xs font-mono text-slate-500 w-10 text-right">{pct}%</span>
                          <span className={`text-[10px] font-bold uppercase tracking-wide px-2 py-1 rounded border ${conf.cls}`}>
                            {conf.text}
                          </span>
                          <span className="text-[10px] font-mono text-slate-400 whitespace-nowrap">
                            {s.n_responses ?? 0} {s.n_responses === 1 ? 'response' : 'responses'}
                          </span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}

            {/* Evidence trail */}
            {evidence.length > 0 && (
              <div>
                <h2 className="text-lg font-black uppercase tracking-widest text-slate-900 mb-4">Evidence</h2>
                <div className="space-y-3">
                  {evidence.slice(0, 8).map((e, i) => (
                    <div key={i} className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
                      <div className="flex items-center justify-between gap-3 mb-2">
                        <span className="text-sm font-semibold text-slate-800">{e.label || e.skill_code}</span>
                        {e.evidence_type && (
                          <span className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded border ${EVIDENCE_BADGE.default}`}>
                            {e.evidence_type.replace(/_/g, ' ')}
                          </span>
                        )}
                      </div>
                      {e.quote && (
                        <p className="text-sm text-slate-500 italic">&ldquo;{e.quote}&rdquo;</p>
                      )}
                      {e.ai_reasoning && (
                        <p className="text-xs text-slate-400 mt-2">{e.ai_reasoning}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
