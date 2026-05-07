'use client'

import Link from 'next/link'

export default function AboutPage() {
  return (
    <div className="bg-transparent min-h-screen pt-32 pb-24">
      {/* SECTION 1: OUR STORY (Refined) */}
      <section className="relative py-24 z-10 text-center">
        <div className="container mx-auto px-4">
          <span className="text-blue-500 font-black text-xs uppercase tracking-[0.5em] mb-6 block animate-fade-in">Established 2026</span>
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
              We built an agentic ecosystem—a place where talent isn't just found, it's discovered through vision. Our journey started in a small studio and has now evolved into a global network of elite creators and visionary companies.
            </p>
          </div>
        </div>
      </section>

      {/* SECTION 2: THE SUCCESS EQUATION (Simplified 3D) */}
      <section className="py-32 z-10 bg-gradient-to-br from-white/5 to-blue-500/5 rounded-[5rem] mx-4 md:mx-10 border border-white/20 shadow-2xl backdrop-blur-sm">
        <div className="container mx-auto px-4">
          <div className="text-center mb-24">
            <span className="text-blue-500 font-black text-[10px] uppercase tracking-[0.5em] mb-6 block">Our Impact</span>
            <h2 className="text-3xl md:text-5xl font-black text-slate-900 mb-6 tracking-tighter uppercase leading-none">The Liftoff <br/> Equation</h2>
            <p className="text-slate-400 font-medium max-w-xl mx-auto">Visualizing the journey from first discovery to successful placement.</p>
          </div>

          <div className="flex flex-col md:flex-row justify-center items-center gap-20 perspective-1000">
            {/* 3D Pillar: APPLIED */}
            <div className="group relative flex flex-col items-center">
              <div 
                className="w-32 bg-slate-100 border border-slate-200 rounded-2xl relative preserve-3d transition-all duration-700 group-hover:rotate-y-12 group-hover:-rotate-x-12 shadow-xl"
                style={{ height: '300px' }}
              >
                {/* Glow Core */}
                <div className="absolute inset-x-4 bottom-0 bg-blue-500/10 rounded-t-xl transition-all duration-1000 h-[85%] group-hover:h-[90%]"></div>
                {/* 3D Label */}
                <div className="absolute -top-12 left-0 right-0 text-center font-black text-blue-600 text-3xl animate-pulse">85k+</div>
              </div>
              <p className="mt-8 text-slate-900 font-black text-xs uppercase tracking-[0.3em]">Applications</p>
            </div>

            {/* The "Bridge" Animation */}
            <div className="hidden md:flex items-center">
              <div className="w-24 h-1 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-full animate-pulse shadow-[0_0_20px_rgba(59,130,246,0.5)]"></div>
            </div>

            {/* 3D Pillar: HIRED */}
            <div className="group relative flex flex-col items-center">
              <div 
                className="w-32 bg-indigo-600 rounded-2xl relative preserve-3d transition-all duration-700 group-hover:rotate-y-12 group-hover:-rotate-x-12 shadow-[0_40px_80px_-15px_rgba(79,70,229,0.4)]"
                style={{ height: '300px' }}
              >
                {/* Shimmer Effect */}
                <div className="btn-shimmer rounded-2xl opacity-30"></div>
                {/* Success Core */}
                <div className="absolute inset-x-4 bottom-0 bg-white/20 rounded-t-xl transition-all duration-1000 h-[40%] group-hover:h-[45%]"></div>
                {/* 3D Label */}
                <div className="absolute -top-12 left-0 right-0 text-center font-black text-white text-3xl drop-shadow-xl">12k+</div>
              </div>
              <p className="mt-8 text-slate-900 font-black text-xs uppercase tracking-[0.3em]">Hired</p>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 3: TESTIMONIALS (Glassmorphism) */}
      <section className="py-40 z-10">
        <div className="container mx-auto px-4">
          <div className="text-center mb-24">
            <h2 className="text-3xl md:text-5xl font-black text-slate-900 mb-6 tracking-tighter uppercase">What the Galaxy Says</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
            {[
              { name: 'Sarah Chen', role: 'Design Lead @ Sphere', text: 'JobStream completely changed how I look for roles. The discovery process is actually fun and beautiful.' },
              { name: 'Marcus Thorne', role: 'CEO @ Flux', text: 'We found our entire core engineering team through this platform. The quality of talent is unmatched.' },
              { name: 'Aria Blue', role: 'Creator @ Origin', text: 'The agentic matching is spooky good. I didn’t even know these opportunities existed until now.' }
            ].map((t, i) => (
              <div key={i} className="bg-white/10 border border-white/20 p-12 rounded-[3rem] transition-all hover:shadow-2xl hover:shadow-blue-500/10 hover:-translate-y-3 group relative overflow-hidden">
                <div className="absolute -top-10 -right-10 w-32 h-32 bg-blue-500/5 rounded-full group-hover:scale-150 transition-transform duration-700"></div>
                <p className="text-slate-600 font-medium italic mb-10 text-lg leading-relaxed">"{t.text}"</p>
                <div>
                  <p className="text-slate-900 font-black uppercase tracking-widest text-sm">{t.name}</p>
                  <p className="text-blue-500 font-bold text-[10px] uppercase tracking-[0.3em]">{t.role}</p>
                </div>
              </div>
            ))}
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
