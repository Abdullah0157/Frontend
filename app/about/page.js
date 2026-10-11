'use client'

import Link from 'next/link'

export default function AboutPage() {
  return (
    <div className="bg-transparent min-h-screen pt-32 pb-24">
      {/* SECTION 1: OUR STORY (Refined) */}
      <section className="relative py-24 z-10 text-center">
        <div className="container mx-auto px-4">
          <span className="text-blue-600 font-black text-xs uppercase tracking-[0.5em] mb-6 block animate-fade-in">Established 2026</span>
          <h1 className="text-4xl md:text-6xl font-black text-slate-900 mb-12 tracking-tighter leading-tight uppercase animate-fade-in">
            A Story of <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600">
              Agentic Discovery
            </span>
          </h1>
          <div className="max-w-3xl mx-auto space-y-8 text-slate-500 text-lg md:text-xl leading-relaxed font-medium animate-fade-in">
            <p>
              JobStream was born from a single realization: the traditional hiring process is static, uninspired, and slow. In a world moving at the speed of thought, we needed a platform that could keep up.
            </p>
            <p>
              So we built JobStream: every applicant takes the same short skills test for the job and a brief AI interview, and the company gets a report showing what each person can actually do. Good people get seen, and hiring teams decide on evidence.
            </p>
          </div>
        </div>
      </section>

      {/* SECTION 2: WHAT WE BELIEVE (replaced made-up application and hire counts) */}
      <section className="py-32 z-10 bg-gradient-to-br from-slate-50 to-blue-50 rounded-[5rem] mx-4 md:mx-10 border border-slate-200 shadow-2xl backdrop-blur-sm">
        <div className="container mx-auto px-4">
          <div className="text-center mb-20">
            <span className="text-blue-600 font-black text-[10px] uppercase tracking-[0.5em] mb-6 block">Our Principles</span>
            <h2 className="text-3xl md:text-5xl font-black text-slate-900 mb-6 tracking-tighter uppercase leading-none">What We <br/> Believe</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-10 max-w-6xl mx-auto">
            {[
              { title: 'Show, Don\u2019t Tell', text: 'A CV says what someone has done. A short, fair test shows what they can do now.' },
              { title: 'People Decide', text: 'Scores help teams focus. JobStream never rejects anyone on its own, and every number comes with its evidence.' },
              { title: 'Fair to Everyone', text: 'Everyone for a job is tested the same way. Accent is never scored, and every candidate gets one fair attempt.' },
            ].map((b) => (
              <div key={b.title} className="bg-white border border-slate-200 p-12 rounded-[3rem] shadow-sm transition-all hover:shadow-2xl hover:shadow-blue-500/10 hover:-translate-y-3 group relative overflow-hidden">
                <div className="absolute -top-10 -right-10 w-32 h-32 bg-blue-500/5 rounded-full group-hover:scale-150 transition-transform duration-700"></div>
                <p className="text-slate-900 font-black uppercase tracking-widest text-sm mb-4">{b.title}</p>
                <p className="text-slate-600 font-medium text-lg leading-relaxed">{b.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* SECTION 3: WHERE WE ARE (replaced three invented testimonials) */}
      <section className="py-40 z-10">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-5xl font-black text-slate-900 mb-6 tracking-tighter uppercase">Where We Are Today</h2>
            <p className="text-slate-600 text-lg md:text-xl leading-relaxed font-medium max-w-3xl mx-auto">
              JobStream is new. Tests are ready for software developers, customer service agents, English level and general workplace
              skills, with more fields on the way. We are working with our first companies and would like to hear from yours.
            </p>
          </div>
        </div>
      </section>

      {/* SECTION 4: FINAL CTA */}
      <section className="py-24 z-10 text-center">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl md:text-5xl font-black text-slate-900 mb-12 tracking-tighter uppercase">Write your own Story</h2>
          <div className="flex justify-center">
            <Link href="/jobs" className="btn-style-9 group uppercase tracking-widest text-sm">
              <div className="btn-shimmer"></div>
              <span>GET STARTED</span>
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
            </Link>
          </div>
        </div>
      </section>

      <style jsx>{`
        .perspective-1000 { perspective: 1000px; }
        .preserve-3d { transform-style: preserve-3d; }
        .rotate-x-45 { transform: rotateX(45deg); }
        .rotate-z-45 { transform: rotateZ(45deg); }
      `}</style>
    </div>
  )
}
