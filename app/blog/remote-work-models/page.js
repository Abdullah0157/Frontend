'use client'

import Link from 'next/link'

export default function RemoteModelsArticle() {
  return (
    <div className="bg-white min-h-screen pt-32 pb-24 font-serif">
      {/* ARTICLE HERO */}
      <header className="container mx-auto px-4 max-w-5xl mb-16 text-center">
        <div className="flex items-center justify-center gap-4 mb-8">
          <span className="text-[10px] font-black text-indigo-600 uppercase tracking-[0.4em] font-sans">Industry Trends</span>
          <span className="text-slate-300 font-sans text-xs">•</span>
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.4em] font-sans">May 2026</span>
          <span className="text-slate-300 font-sans text-xs">•</span>
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.4em] font-sans">2 min read</span>
        </div>
        
        <h1 className="text-5xl md:text-7xl font-black text-slate-900 mb-8 leading-tight tracking-tighter">
          Micro-Jobs vs Freelance <br /> vs Full-Time
        </h1>
        
        <p className="text-xl md:text-2xl text-slate-500 leading-relaxed font-sans max-w-2xl mx-auto font-medium">
          Not all remote work is the same. Before jumping in, you need to understand the three main models and pick the one that fits your life.
        </p>
      </header>

      {/* HERO IMAGE / GRAPHIC */}
      <div className="container mx-auto px-4 max-w-5xl mb-24">
        <div className="aspect-[21/9] bg-gradient-to-br from-indigo-950 via-indigo-900 to-indigo-800 rounded-[4rem] overflow-hidden flex items-center justify-center relative shadow-2xl">
          {/* Abstract Ellipses Graphic */}
          <div className="absolute inset-0 opacity-20">
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[90%] h-[70%] border-[1px] border-white rounded-[10rem]"></div>
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[70%] h-[50%] border-[1px] border-white rounded-[10rem]"></div>
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[40%] h-[25%] border-[1px] border-white rounded-[10rem]"></div>
          </div>
          <span className="relative z-10 text-white/5 font-black text-7xl md:text-[12rem] uppercase tracking-[0.2em] font-sans">JOBSTREAM</span>
        </div>
      </div>
      {/* ARTICLE CONTENT */}
      <article className="container mx-auto px-4 max-w-3xl">
        <div className="prose prose-slate prose-lg max-w-none">
          
          <div className="space-y-16">
            {/* MICRO-JOBS */}
            <section className="group">
              <div className="flex items-center gap-6 mb-6">
                <span className="w-12 h-12 rounded-2xl bg-indigo-600 text-white flex items-center justify-center font-black text-xl shadow-lg shadow-indigo-200 font-sans flex-shrink-0">1</span>
                <h2 className="text-2xl md:text-3xl font-black text-slate-900 m-0 uppercase tracking-tight font-sans">MICRO JOBS (BEST FOR BEGINNERS)</h2>
              </div>
              <p className="text-lg leading-relaxed text-slate-600 font-medium mb-8">
                Micro jobs are small, quick tasks that pay $25–$150 each. Think writing a product description, designing a logo, or editing a short video.
              </p>
              <div className="bg-slate-50 p-8 rounded-3xl border border-slate-100 mb-8">
                <h4 className="text-sm font-black text-slate-900 uppercase tracking-widest mb-6 font-sans">Perfect if you:</h4>
                <ul className="space-y-4 list-none p-0">
                  <li className="flex items-start gap-3 text-slate-600 font-medium font-sans">
                    <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full mt-2.5 flex-shrink-0"></span>
                    Are just starting out
                  </li>
                  <li className="flex items-start gap-3 text-slate-600 font-medium font-sans">
                    <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full mt-2.5 flex-shrink-0"></span>
                    Want to build reviews fast
                  </li>
                  <li className="flex items-start gap-3 text-slate-600 font-medium font-sans">
                    <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full mt-2.5 flex-shrink-0"></span>
                    Need flexible, no-commitment work
                  </li>
                  <li className="flex items-start gap-3 text-slate-600 font-medium font-sans">
                    <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full mt-2.5 flex-shrink-0"></span>
                    Want to test your skills before going bigger
                  </li>
                </ul>
              </div>
              <p className="text-sm font-bold text-indigo-900 uppercase tracking-widest font-sans flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                Downside: Income is unpredictable. You're always hunting for the next task.
              </p>
            </section>

            {/* FREELANCE */}
            <section className="group">
              <div className="flex items-center gap-6 mb-6">
                <span className="w-12 h-12 rounded-2xl bg-slate-900 text-white flex items-center justify-center font-black text-xl shadow-lg shadow-slate-200 font-sans flex-shrink-0">2</span>
                <h2 className="text-2xl md:text-3xl font-black text-slate-900 m-0 uppercase tracking-tight font-sans">FREELANCE PROJECTS (BEST FOR GROWTH)</h2>
              </div>
              <p className="text-lg leading-relaxed text-slate-600 font-medium mb-8">
                Freelancing means bigger projects, longer timelines, and stronger client relationships. Projects typically range from $500 to $10,000+.
              </p>
              <div className="bg-slate-50 p-8 rounded-3xl border border-slate-100 mb-8">
                <h4 className="text-sm font-black text-slate-900 uppercase tracking-widest mb-6 font-sans">Perfect if you:</h4>
                <ul className="space-y-4 list-none p-0">
                  <li className="flex items-start gap-3 text-slate-600 font-medium font-sans">
                    <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full mt-2.5 flex-shrink-0"></span>
                    Have a solid skill set
                  </li>
                  <li className="flex items-start gap-3 text-slate-600 font-medium font-sans">
                    <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full mt-2.5 flex-shrink-0"></span>
                    Want higher, project-based income
                  </li>
                  <li className="flex items-start gap-3 text-slate-600 font-medium font-sans">
                    <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full mt-2.5 flex-shrink-0"></span>
                    Enjoy working with multiple clients
                  </li>
                  <li className="flex items-start gap-3 text-slate-600 font-medium font-sans">
                    <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full mt-2.5 flex-shrink-0"></span>
                    Prefer variety over routine
                  </li>
                </ul>
              </div>
              <p className="text-sm font-bold text-indigo-900 uppercase tracking-widest font-sans flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                Downside: Requires client management, invoicing, and self-discipline.
              </p>
            </section>

            {/* FULL-TIME */}
            <section className="group">
              <div className="flex items-center gap-6 mb-6">
                <span className="w-12 h-12 rounded-2xl bg-indigo-600 text-white flex items-center justify-center font-black text-xl shadow-lg shadow-indigo-200 font-sans flex-shrink-0">3</span>
                <h2 className="text-2xl md:text-3xl font-black text-slate-900 m-0 uppercase tracking-tight font-sans">FULL TIME REMOTE (BEST FOR STABILITY)</h2>
              </div>
              <p className="text-lg leading-relaxed text-slate-600 font-medium mb-8">
                A full time remote job gives you a steady salary, benefits, and one company to focus on.
              </p>
              <div className="bg-slate-50 p-8 rounded-3xl border border-slate-100 mb-8">
                <h4 className="text-sm font-black text-slate-900 uppercase tracking-widest mb-6 font-sans">Perfect if you:</h4>
                <ul className="space-y-4 list-none p-0">
                  <li className="flex items-start gap-3 text-slate-600 font-medium font-sans">
                    <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full mt-2.5 flex-shrink-0"></span>
                    Want income security
                  </li>
                  <li className="flex items-start gap-3 text-slate-600 font-medium font-sans">
                    <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full mt-2.5 flex-shrink-0"></span>
                    Prefer a structured schedule
                  </li>
                  <li className="flex items-start gap-3 text-slate-600 font-medium font-sans">
                    <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full mt-2.5 flex-shrink-0"></span>
                    Value health benefits and paid leave
                  </li>
                  <li className="flex items-start gap-3 text-slate-600 font-medium font-sans">
                    <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full mt-2.5 flex-shrink-0"></span>
                    Like growing within one team
                  </li>
                </ul>
              </div>
              <p className="text-sm font-bold text-indigo-900 uppercase tracking-widest font-sans flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                Downside: Less flexibility, income is capped.
              </p>
            </section>

            {/* COMPARISON TABLE */}
            <section className="py-20">
              <h2 className="text-2xl font-black text-slate-900 mb-12 uppercase tracking-tight text-center font-sans">WHICH SHOULD YOU CHOOSE?</h2>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse font-sans">
                  <thead>
                    <tr className="bg-gradient-to-r from-blue-600 via-indigo-900 to-slate-950 text-white">
                      <th className="p-6 text-left text-[10px] font-black uppercase tracking-widest">Model</th>
                      <th className="p-6 text-left text-[10px] font-black uppercase tracking-widest">Income</th>
                      <th className="p-6 text-left text-[10px] font-black uppercase tracking-widest">Flexibility</th>
                      <th className="p-6 text-left text-[10px] font-black uppercase tracking-widest">Benefits</th>
                      <th className="p-6 text-left text-[10px] font-black uppercase tracking-widest">Best For</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                      <td className="p-6 font-black text-slate-900 text-sm">Micro-Jobs</td>
                      <td className="p-6 text-slate-600 text-sm">Variable</td>
                      <td className="p-6 text-slate-600 text-sm font-black">High</td>
                      <td className="p-6 text-slate-400 text-sm">None</td>
                      <td className="p-6 text-slate-600 text-sm">Beginners</td>
                    </tr>
                    <tr className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                      <td className="p-6 font-black text-slate-900 text-sm">Freelance</td>
                      <td className="p-6 text-slate-600 text-sm">Variable</td>
                      <td className="p-6 text-slate-600 text-sm font-black">High</td>
                      <td className="p-6 text-slate-400 text-sm">None</td>
                      <td className="p-6 text-slate-600 text-sm">Intermediate</td>
                    </tr>
                    <tr className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                      <td className="p-6 font-black text-slate-900 text-sm">Full-Time</td>
                      <td className="p-6 text-indigo-600 text-sm font-black">Stable</td>
                      <td className="p-6 text-slate-600 text-sm">Medium</td>
                      <td className="p-6 text-indigo-600 text-sm font-black">Yes</td>
                      <td className="p-6 text-slate-600 text-sm">All levels</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>
          </div>

          <div className="mt-24 pt-12 border-t border-slate-100">
            <p className="text-xl leading-relaxed text-slate-900 font-bold mb-12">
              Start with micro-jobs → grow into freelance → settle into full-time if stability is your goal. Or freelance forever if freedom is your priority. There's no wrong answer, only what works for you.
            </p>
            
            <div className="bg-indigo-50 p-12 rounded-[3rem] border border-indigo-100 text-center">
              <h3 className="text-2xl font-black text-indigo-900 mb-6 font-sans uppercase tracking-widest">Ready to find your first remote opportunity?</h3>
              <Link href="/jobs" className="btn-style-9 !bg-indigo-600 !text-white hover:!bg-indigo-700 mx-auto group uppercase tracking-widest text-sm shadow-2xl">
                <div className="btn-shimmer"></div>
                <span>Browse jobs on JobStream today</span>
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                </svg>
              </Link>
            </div>
          </div>
        </div>
      </article>

      {/* FOOTER INFO */}
      <footer className="container mx-auto px-4 max-w-3xl mt-20 pt-10 border-t border-slate-50 flex justify-between items-center opacity-40">
        <span className="text-[10px] font-black uppercase tracking-widest font-sans">JobStream | Industry Trends</span>
        <span className="text-[10px] font-black uppercase tracking-widest font-sans">May 2026</span>
      </footer>
    </div>
  )
}
