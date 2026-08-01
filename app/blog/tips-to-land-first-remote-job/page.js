'use client'

import Link from 'next/link'

export default function ArticlePage() {
  return (
    <div className="bg-white min-h-screen pt-32 pb-24 font-serif">
      {/* ARTICLE HERO */}
      <header className="container mx-auto px-4 max-w-5xl mb-16 text-center">
        <div className="flex items-center justify-center gap-4 mb-8">
          <span className="text-[10px] font-black text-indigo-600 uppercase tracking-[0.4em] font-sans">Career Tips</span>
          <span className="text-slate-700 font-sans text-xs">•</span>
          <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.4em] font-sans">May 2026</span>
          <span className="text-slate-700 font-sans text-xs">•</span>
          <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.4em] font-sans">2 min read</span>
        </div>

        <h1 className="text-5xl md:text-7xl font-black text-slate-900 mb-8 leading-tight tracking-tighter">
          5 Tips to Land Your First <br /> Remote Job in 2026
        </h1>

        <p className="text-xl md:text-2xl text-slate-500 leading-relaxed font-sans max-w-2xl mx-auto font-medium">
          Breaking into remote work isn't as hard as it seems, but it does require the right strategy.
        </p>
      </header>

      {/* HERO IMAGE */}
      <div className="container mx-auto px-4 max-w-5xl mb-24">
        <div className="aspect-[21/9] rounded-[4rem] overflow-hidden relative shadow-2xl border border-slate-200">
          <img
            src="https://images.unsplash.com/photo-1521737711867-e3b97375f902?auto=format&fit=crop&w=1600&q=80"
            alt="Person working remotely on a laptop with a coffee cup"
            className="w-full h-full object-cover"
            loading="eager"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-900/70 via-slate-900/20 to-transparent" />
        </div>
      </div>

      {/* ARTICLE CONTENT */}
      <article className="container mx-auto px-4 max-w-3xl">
        <div className="prose prose-slate prose-lg max-w-none">
          <p className="text-lg leading-relaxed text-slate-700 mb-12 italic border-l-4 border-indigo-200 pl-6">
            Breaking into remote work isn't as hard as it seems, but it does require the right strategy. Here are five tips to help you land your first remote job faster.
          </p>

          <div className="space-y-16">
            {/* Tip 1 */}
            <section className="group">
              <div className="flex items-center gap-6 mb-6">
                <span className="w-12 h-12 rounded-2xl bg-indigo-600 text-white flex items-center justify-center font-black text-xl shadow-lg shadow-indigo-200 font-sans">1</span>
                <h2 className="text-2xl md:text-3xl font-black text-slate-900 m-0 uppercase tracking-tight font-sans">Complete Your Profile 100%</h2>
              </div>
              <p className="text-lg leading-relaxed text-slate-700 font-medium">
                A complete profile gets 3x more job offers. Add a professional photo, list your top skills, write a clear bio, and set your rate. First impressions matter.
              </p>
            </section>

            {/* Tip 2 */}
            <section className="group">
              <div className="flex items-center gap-6 mb-6">
                <span className="w-12 h-12 rounded-2xl bg-slate-900 text-white flex items-center justify-center font-black text-xl shadow-lg shadow-slate-200 font-sans">2</span>
                <h2 className="text-2xl md:text-3xl font-black text-slate-900 m-0 uppercase tracking-tight font-sans">Build a Simple Portfolio</h2>
              </div>
              <p className="text-lg leading-relaxed text-slate-700 font-medium">
                No experience? No problem. Create 2–3 personal projects that showcase your skills. Write on Medium, design on Dribbble, or build on GitHub. Show companies what you can do, not just tell them.
              </p>
            </section>

            {/* Tip 3 */}
            <section className="group">
              <div className="flex items-center gap-6 mb-6">
                <span className="w-12 h-12 rounded-2xl bg-indigo-600 text-white flex items-center justify-center font-black text-xl shadow-lg shadow-indigo-200 font-sans">3</span>
                <h2 className="text-2xl md:text-3xl font-black text-slate-900 m-0 uppercase tracking-tight font-sans">Apply Smart, Not Fast</h2>
              </div>
              <p className="text-lg leading-relaxed text-slate-700 font-medium">
                Stop sending 50 generic applications. Send 5 personalized ones instead. Read the job posting carefully, mention specific details, and explain exactly why you're a great fit. Quality always beats quantity.
              </p>
            </section>

            {/* Tip 4 */}
            <section className="group">
              <div className="flex items-center gap-6 mb-6">
                <span className="w-12 h-12 rounded-2xl bg-slate-900 text-white flex items-center justify-center font-black text-xl shadow-lg shadow-slate-200 font-sans">4</span>
                <h2 className="text-2xl md:text-3xl font-black text-slate-900 m-0 uppercase tracking-tight font-sans">Respond Fast</h2>
              </div>
              <p className="text-lg leading-relaxed text-slate-700 font-medium">
                Most candidates take 12+ hours to reply. If you respond within 1 hour, you're already ahead of 90% of applicants. Speed signals professionalism and seriousness.
              </p>
            </section>

            {/* Tip 5 */}
            <section className="group">
              <div className="flex items-center gap-6 mb-6">
                <span className="w-12 h-12 rounded-2xl bg-indigo-600 text-white flex items-center justify-center font-black text-xl shadow-lg shadow-indigo-200 font-sans">5</span>
                <h2 className="text-2xl md:text-3xl font-black text-slate-900 m-0 uppercase tracking-tight font-sans">Start Small to Build Reputation</h2>
              </div>
              <p className="text-lg leading-relaxed text-slate-700 font-medium">
                Take a small $100–300 job first. Deliver it exceptionally. Ask for a detailed review. That first 5-star rating changes everything. Companies will start coming to you.
              </p>
            </section>
          </div>

          <div className="mt-24 pt-12 border-t border-slate-200">
            <p className="text-xl leading-relaxed text-slate-900 font-bold mb-12">
              Your first remote job won't be your dream job but it opens the door to everything else. Follow these five steps and you'll land it faster than you think.
            </p>

            <div className="bg-indigo-50 p-12 rounded-[3rem] border border-indigo-200 text-center">
              <h3 className="text-2xl font-black text-indigo-900 mb-6 font-sans uppercase tracking-widest">Ready to start?</h3>
              <Link href="/jobs" className="btn-style-9 !bg-indigo-600 !text-white hover:!bg-indigo-700 mx-auto group uppercase tracking-widest text-sm shadow-2xl">
                <div className="btn-shimmer"></div>
                <span>Browse remote jobs on JobStream today</span>
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                </svg>
              </Link>
            </div>
          </div>
        </div>
      </article>

      {/* FOOTER INFO */}
      <footer className="container mx-auto px-4 max-w-3xl mt-20 pt-10 border-t border-slate-200 flex justify-between items-center opacity-40">
        <span className="text-[10px] font-black uppercase tracking-widest font-sans">JobStream | Career Tips</span>
        <span className="text-[10px] font-black uppercase tracking-widest font-sans">May 2026</span>
      </footer>
    </div>
  )
}
