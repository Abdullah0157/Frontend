'use client'

import Link from 'next/link'
import Globe from '../components/Globe'

export default function LandingPage() {
  return (
    <div className="bg-transparent min-h-screen pb-24">
      {/* SECTION 1: THE VISION (Refined White Hero with Globe on Right) */}
      <section className="relative pt-48 pb-32 z-10 text-slate-900 overflow-hidden min-h-[100vh] flex items-center">
        <div className="container mx-auto px-4 relative z-20">
          <div className="max-w-2xl">
            <div className="inline-flex items-center px-4 py-2 rounded-full bg-indigo-50/30 border border-indigo-100/30 text-indigo-600 text-[10px] font-black mb-10 animate-fade-in uppercase tracking-[0.4em]">
              JobStream Platform
            </div>
            <h1 className="text-3xl md:text-5xl lg:text-6xl font-black mb-8 tracking-tight leading-tight uppercase animate-fade-in text-slate-900">
              Connect With Top <br />
              <span className="text-indigo-600">
                Companies around the world
              </span>
            </h1>
            <p className="text-slate-500 text-base md:text-lg max-w-lg mb-12 leading-relaxed font-medium animate-fade-in">
              Get hired by leading companies offering remote positions from micro tasks to full-time roles. Your skills, their opportunities.
            </p>

            <div className="flex animate-fade-in">
              <Link href="/jobs" className="btn-style-9 group uppercase tracking-widest text-xs shadow-2xl !px-12 !py-6 rounded-full font-black">
                <div className="btn-shimmer"></div>
                <span>Explore Jobs Now</span>
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                </svg>
              </Link>
            </div>
          </div>
        </div>

        {/* The Globe - Positioned to show more of the bottom */}
        <div className="absolute top-[12%] right-[-15%] translate-y-[-50%] w-[85vh] h-[85vh] max-w-[900px] max-h-[900px] animate-fade-in pointer-events-none z-10">
          <div className="absolute inset-0 bg-indigo-100/20 blur-[120px] rounded-full"></div>
          <Globe />
        </div>
      </section>

      {/* SECTION 2: AI POWERED RECOMMENDATIONS */}
      <section className="py-32 z-10 relative overflow-hidden">
        <div className="container mx-auto px-4">
          <div className="max-w-6xl mx-auto">
            <div className="bg-gradient-to-br from-white to-indigo-50/30 border border-slate-100 rounded-[4rem] p-12 md:p-20 shadow-2xl shadow-indigo-500/5 relative overflow-hidden group">
              {/* Background Decoration */}
              <div className="absolute -top-24 -right-24 w-64 h-64 bg-indigo-500/5 blur-[80px] rounded-full group-hover:bg-indigo-500/10 transition-colors"></div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center relative z-10">
                <div>
                  <div className="inline-flex items-center px-4 py-2 rounded-full bg-indigo-600 text-white text-[10px] font-black mb-8 uppercase tracking-[0.4em] shadow-lg shadow-indigo-500/40">
                    AI Feature
                  </div>
                  <h2 className="text-4xl md:text-5xl font-black text-slate-900 mb-8 tracking-tighter uppercase leading-[0.9]">
                    AI  POWERED <br />
                    <span className="text-indigo-600">JOB MATCHING</span>
                  </h2>
                  <p className="text-slate-500 text-lg md:text-xl font-medium leading-relaxed mb-10">
                    Stop searching. Start being found. Our advanced AI scans your CV in seconds to suggest opportunities tailored specifically to your unique journey.
                  </p>
                  <div className="flex flex-col gap-6">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-600">
                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                      </div>
                      <span className="font-black text-slate-700 uppercase tracking-widest text-xs">Precise CV Scanning</span>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-600">
                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                      </div>
                      <span className="font-black text-slate-700 uppercase tracking-widest text-xs">Instant Recommendations</span>
                    </div>
                  </div>
                </div>

                <div className="bg-white border border-slate-100 p-10 rounded-[3rem] shadow-xl relative group-hover:scale-[1.02] transition-transform duration-500">
                  <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 to-transparent rounded-[3rem]"></div>
                  <div className="relative z-10">
                    <div className="flex justify-between items-center mb-10">

                      <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">Scanning Active</span>
                    </div>
                    <p className="text-2xl md:text-3xl font-black text-slate-900 uppercase tracking-tighter leading-tight mb-12">
                      Our AI will scan your CV and suggest you jobs <span className="text-indigo-600">according to you.</span>
                    </p>
                    <div className="flex">

                      <Link href="/jobs" className="btn-style-9 group uppercase tracking-widest text-xs shadow-2xl !px-20 !py-6 rounded-full font-black">
                        <div className="btn-shimmer"></div>
                        <span>Try it</span>
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                        </svg>
                      </Link>

                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 3: STATS & PARTNERS */}
      <section className="py-32 z-10 bg-white">
        <div className="container mx-auto px-4">
          {/* TRUSTED PARTNERS MARQUEE */}
          <div className="relative">
            <p className="text-center text-slate-400 font-black uppercase tracking-[0.4em] text-[10px] mb-12">Integrated with Global Leaders</p>

            <div className="relative overflow-hidden w-full max-w-5xl mx-auto flex items-center h-24 mask-marquee">
              <div className="animate-marquee flex items-center gap-24 whitespace-nowrap">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="flex gap-32 items-center opacity-40 grayscale hover:grayscale-0 hover:opacity-100 transition-all duration-300">
                    <span className="text-3xl font-bold tracking-tight text-slate-800 flex items-center">
                      <svg className="w-8 h-8 mr-2 text-indigo-600" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" /></svg>
                      mercor
                    </span>
                    <span className="text-4xl font-black tracking-tighter text-slate-800">micro1</span>
                    <span className="text-3xl font-black tracking-tighter text-slate-800 flex items-center">
                      <svg className="w-8 h-8 mr-2 text-[#0077B5]" viewBox="0 0 448 512" fill="currentColor"><path d="M416 32H31.9C14.3 32 0 46.5 0 64.3v383.4C0 465.5 14.3 480 31.9 480H416c17.6 0 32-14.5 32-32.3V64.3c0-17.8-14.4-32.3-32-32.3zM135.4 416H69V202.2h66.5V416zm-33.2-243c-21.3 0-38.5-17.3-38.5-38.5S80.9 96 102.2 96c21.2 0 38.5 17.3 38.5 38.5 0 21.3-17.2 38.5-38.5 38.5zm282.1 243h-66.4V312c0-24.8-.5-56.7-34.5-56.7-34.6 0-39.9 27-39.9 54.9V416h-66.4V202.2h63.7v29.2h.9c8.9-16.8 30.6-34.5 62.9-34.5 67.2 0 79.7 44.3 79.7 101.9V416z"/></svg>
                      linkedin
                    </span>
                    <span className="text-3xl font-black tracking-tighter text-slate-800">glassdoor</span>
                    <span className="text-3xl font-black tracking-tighter text-slate-800">indeed</span>
                    <span className="text-3xl font-black tracking-tighter text-slate-800">upwork</span>
                    <span className="text-3xl font-black tracking-tighter text-slate-800">toptal</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 4: THE VISION AREA - High-Impact Redesign */}
      <section className="py-32 z-10 relative overflow-hidden bg-gradient-to-br from-blue-700 via-indigo-950 to-black mx-4 md:mx-10 rounded-[5rem] shadow-2xl border border-white/10">
        {/* Decorative Background Elements */}
        <div className="absolute top-0 left-0 w-full h-full bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-10"></div>
        <div className="absolute -top-24 -right-24 w-96 h-96 bg-blue-500/10 blur-[120px] rounded-full"></div>
        <div className="absolute -bottom-24 -left-24 w-96 h-96 bg-indigo-500/10 blur-[120px] rounded-full"></div>

        <div className="container mx-auto px-4 relative z-10">
          <div className="max-w-5xl mx-auto">
            {/* Header */}
            <div className="text-center mb-24">
              <span className="inline-block px-4 py-1.5 rounded-full bg-white/5 border border-white/10 text-blue-400 font-black text-[10px] uppercase tracking-[0.5em] mb-6">THE VISION</span>
              <h2 className="text-4xl md:text-6xl font-black text-white tracking-tighter uppercase leading-[0.9] mb-8">
                STOP SETTLING <br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-300">FOR LESS</span>
              </h2>
            </div>

            {/* High-Impact Feature Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-24">
              {[
                { title: 'Talented', text: "You're not just a skill set." },
                { title: 'Capable', text: "You're built for more." },
                { title: 'Worth More', text: "Demand your true value." }
              ].map((item, i) => (
                <div key={i} className="bg-white/[0.03] backdrop-blur-md border border-white/10 p-10 rounded-[3rem] text-center hover:bg-white/[0.05] transition-all hover:-translate-y-2 group">
                  <span className="text-3xl font-black text-white uppercase tracking-tighter mb-4 block group-hover:text-blue-400 transition-colors">{item.title}</span>
                  <p className="text-slate-400 text-sm font-medium">{item.text}</p>
                </div>
              ))}
            </div>

            {/* The Mission Narrative */}
            <div className="max-w-3xl mx-auto bg-white/[0.02] border border-white/5 p-12 rounded-[4rem] backdrop-blur-sm">
              <div className="grid grid-cols-1 md:grid-cols-1 gap-10 text-center">
                <p className="text-xl md:text-2xl text-slate-300 leading-relaxed font-medium">
                  The job market treats you like a number. We're changing that.
                  JobStream connects you with opportunities that see <span className="text-white font-black underline decoration-blue-500 decoration-4 underline-offset-8">YOUR</span> real potential.
                </p>
                <div className="pt-8 border-t border-white/5">
                  <p className="text-2xl md:text-4xl text-white font-black tracking-tight uppercase leading-tight">
                    Not just your resume. <br />
                    <span className="text-blue-400">You. As a whole.</span>
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-20 flex justify-center">
              <Link href="/jobs" className="btn-style-9 !bg-white !text-black hover:!bg-slate-100 group uppercase tracking-widest text-xs shadow-2xl !px-12 !py-6 rounded-full font-black">
                <div className="btn-shimmer"></div>
                <span>Join the Network</span>
                <svg className="w-4 h-4 ml-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                </svg>
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
