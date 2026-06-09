'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import Globe from '../components/Globe'
import LoadingState from '../components/LoadingState'
import { getSupabaseBrowser } from '@/lib/supabase/client'

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
    <div className="bg-transparent min-h-screen pb-24">
      {isMatching && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/80 backdrop-blur-xl">
          <LoadingState message="Scanning Network for Matches" />
        </div>
      )}

      {/* SECTION 1: THE VISION */}
      <section className="relative pt-48 pb-32 z-10 text-white overflow-hidden min-h-[100vh] flex items-center">
        <div className="container mx-auto px-4 relative z-20">
          <div className="max-w-2xl">
            <div className="inline-flex items-center px-4 py-2 rounded-full bg-indigo-950/30 border border-indigo-900/30 text-indigo-400 text-[10px] font-black mb-10 animate-fade-in uppercase tracking-[0.4em]">
              JobStream Platform
            </div>
            <h1 className="text-3xl md:text-5xl lg:text-6xl font-black mb-8 tracking-tight leading-tight uppercase animate-fade-in text-white">
              Connect With Top <br />
              <span className="text-indigo-400">
                Companies around the world
              </span>
            </h1>
            <p className="text-slate-400 text-base md:text-lg max-w-lg mb-12 leading-relaxed font-medium animate-fade-in">
              Get hired by leading companies offering remote positions from micro tasks to full-time roles. Your skills, their opportunities.
            </p>

            <div className="flex animate-fade-in">
              <Link href="/jobs" prefetch={true} className="btn-style-9 group uppercase tracking-widest text-xs shadow-2xl !px-12 !py-6 rounded-full font-black">
                <div className="btn-shimmer"></div>
                <span>Explore Jobs Now</span>
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                </svg>
              </Link>
            </div>
          </div>
        </div>

        <div className="absolute top-[12%] right-[-15%] translate-y-[-50%] w-[85vh] h-[85vh] max-w-[900px] max-h-[900px] animate-fade-in pointer-events-none z-10">
          <div className="absolute inset-0 bg-indigo-100/20 blur-[120px] rounded-full"></div>
          <Globe />
        </div>
      </section>

      {/* SECTION 2: AI POWERED RECOMMENDATIONS */}
      <section className="py-32 z-10 relative overflow-hidden">
        <div className="container mx-auto px-4">
          <div className="max-w-6xl mx-auto">
            <div className="bg-gradient-to-br from-slate-900 to-indigo-50/30 border border-slate-800 rounded-[4rem] p-12 md:p-20 shadow-2xl shadow-indigo-500/5 relative overflow-hidden group">
              <div className="absolute -top-24 -right-24 w-64 h-64 bg-indigo-500/5 blur-[80px] rounded-full group-hover:bg-indigo-500/10 transition-colors"></div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center relative z-10">
                <div>
                  <div className="inline-flex items-center px-4 py-2 rounded-full bg-indigo-600 text-white text-[10px] font-black mb-8 uppercase tracking-[0.4em] shadow-lg shadow-indigo-500/40">
                    AI Feature
                  </div>
                  <h2 className="text-4xl md:text-5xl font-black text-white mb-8 tracking-tighter uppercase leading-[0.9]">
                    AI  POWERED <br />
                    <span className="text-indigo-400">JOB MATCHING</span>
                  </h2>
                  <p className="text-slate-400 text-lg md:text-xl font-medium leading-relaxed mb-10">
                    Stop searching. Start being found. Our advanced AI scans your CV in seconds to suggest opportunities tailored specifically to your unique journey.
                  </p>
                  <div className="flex flex-col gap-6">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-2xl bg-indigo-950/40 flex items-center justify-center text-indigo-400">
                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                      </div>
                      <span className="font-black text-slate-200 uppercase tracking-widest text-xs">Precise CV Scanning</span>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-2xl bg-indigo-950/40 flex items-center justify-center text-indigo-400">
                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                      </div>
                      <span className="font-black text-slate-200 uppercase tracking-widest text-xs">Instant Recommendations</span>
                    </div>
                  </div>
                </div>

                <div className="bg-slate-900 border border-slate-800 p-10 rounded-[3rem] shadow-xl relative group-hover:scale-[1.02] transition-transform duration-500">
                  <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 to-transparent rounded-[3rem]"></div>
                  <div className="relative z-10">
                    <div className="flex justify-between items-center mb-10">
                      <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">Scanning Active</span>
                    </div>
                    <p className="text-2xl md:text-3xl font-black text-white uppercase tracking-tighter leading-tight mb-12">
                      Our AI will scan your CV and suggest you jobs <span className="text-indigo-400">according to you.</span>
                    </p>
                    <div className="flex">
                      <button
                        type="button"
                        onClick={handleAiMatch}
                        disabled={isMatching}
                        className="btn-style-9 cursor-pointer group uppercase tracking-widest text-xs shadow-2xl !px-20 !py-6 rounded-full font-black disabled:opacity-60 disabled:cursor-not-allowed"
                      >
                        <div className="btn-shimmer"></div>
                        <span>{isMatching ? 'Loading…' : 'Find My Matches'}</span>
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 3: STATS & PARTNERS */}
      <section className="py-32 z-10 bg-slate-900">
        <div className="container mx-auto px-4">
          <div className="relative">
            <p className="text-center text-slate-400 font-black uppercase tracking-[0.4em] text-[10px] mb-12">Integrated with Global Leaders</p>
            <div className="relative overflow-hidden w-full max-w-5xl mx-auto flex items-center h-24 mask-marquee">
              <div className="animate-marquee flex items-center gap-24 whitespace-nowrap">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="flex gap-32 items-center opacity-40 grayscale hover:grayscale-0 hover:opacity-100 transition-all duration-300">
                    <span className="text-3xl font-bold tracking-tight text-slate-100 flex items-center">
                      <svg className="w-8 h-8 mr-2 text-indigo-400" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" /></svg>
                      mercor
                    </span>
                    <span className="text-4xl font-black tracking-tighter text-slate-100">micro1</span>
                    <span className="text-3xl font-black tracking-tighter text-slate-100 flex items-center">
                      <svg className="w-8 h-8 mr-2 text-[#0077B5]" viewBox="0 0 448 512" fill="currentColor"><path d="M416 32H31.9C14.3 32 0 46.5 0 64.3v383.4C0 465.5 14.3 480 31.9 480H416c17.6 0 32-14.5 32-32.3V64.3c0-17.8-14.4-32.3-32-32.3zM135.4 416H69V202.2h66.5V416zm-33.2-243c-21.3 0-38.5-17.3-38.5-38.5S80.9 96 102.2 96c21.2 0 38.5 17.3 38.5 38.5 0 21.3-17.2 38.5-38.5 38.5zm282.1 243h-66.4V312c0-24.8-.5-56.7-34.5-56.7-34.6 0-39.9 27-39.9 54.9V416h-66.4V202.2h63.7v29.2h.9c8.9-16.8 30.6-34.5 62.9-34.5 67.2 0 79.7 44.3 79.7 101.9V416z"/></svg>
                      linkedin
                    </span>
                    <span className="text-3xl font-black tracking-tighter text-slate-100">glassdoor</span>
                    <span className="text-3xl font-black tracking-tighter text-slate-100">indeed</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 4: THE VISION AREA */}
      <section className="py-32 z-10 relative overflow-hidden bg-gradient-to-br from-indigo-950/40 via-slate-950 to-blue-950/40 mx-4 md:mx-10 rounded-[5rem] shadow-2xl border border-slate-800">
        <div className="absolute -top-24 -right-24 w-96 h-96 bg-indigo-200/40 blur-[120px] rounded-full"></div>
        <div className="absolute -bottom-24 -left-24 w-96 h-96 bg-blue-200/40 blur-[120px] rounded-full"></div>
        <div className="container mx-auto px-4 relative z-10">
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-24">
              <span className="inline-block px-4 py-1.5 rounded-full bg-indigo-950/40 border border-indigo-900 text-indigo-400 font-black text-[10px] uppercase tracking-[0.5em] mb-6">THE VISION</span>
              <h2 className="text-4xl md:text-6xl font-black text-white tracking-tighter uppercase leading-[0.9] mb-8">
                STOP SETTLING <br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600">FOR LESS</span>
              </h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-24">
              {[
                { title: 'Talented', text: "You're not just a skill set." },
                { title: 'Capable', text: "You're built for more." },
                { title: 'Worth More', text: "Demand your true value." }
              ].map((item, i) => (
                <div key={i} className="bg-slate-900 border border-slate-800 p-10 rounded-[3rem] text-center hover:shadow-xl hover:shadow-indigo-500/10 transition-all hover:-translate-y-2 group">
                  <span className="text-3xl font-black text-white uppercase tracking-tighter mb-4 block group-hover:text-indigo-400 transition-colors">{item.title}</span>
                  <p className="text-slate-400 text-sm font-medium">{item.text}</p>
                </div>
              ))}
            </div>
            <div className="max-w-3xl mx-auto bg-slate-900 border border-slate-800 p-12 rounded-[4rem] text-center shadow-sm">
              <p className="text-xl md:text-2xl text-slate-300 leading-relaxed font-medium mb-8">
                The job market treats you like a number. We're changing that.
                JobStream connects you with opportunities that see <span className="text-white font-black underline decoration-indigo-500 decoration-4 underline-offset-8">YOUR</span> real potential.
              </p>
              <div className="pt-8 border-t border-slate-800">
                <p className="text-2xl md:text-4xl text-white font-black tracking-tight uppercase leading-tight">
                  Not just your resume. <br />
                  <span className="text-indigo-400">You. As a whole.</span>
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
