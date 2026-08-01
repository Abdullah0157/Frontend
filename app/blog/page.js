'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

const StatItem = ({ initialValue, suffix, label, colorClass }) => {
  const [count, setCount] = useState(0)
  const target = parseInt(initialValue.replace(/[^0-9]/g, ''))

  useEffect(() => {
    let start = 0
    const duration = 3000 // Optimized (3 seconds)
    const interval = 16
    const totalSteps = duration / interval
    const increment = target / totalSteps

    const timer = setInterval(() => {
      start += increment
      if (start >= target) {
        setCount(target)
        clearInterval(timer)
      } else {
        setCount(Math.floor(start))
      }
    }, interval)

    return () => clearInterval(timer)
  }, [target])

  return (
    <div
      className="text-center md:text-left cursor-pointer group"
      onClick={() => setCount(prev => prev + 1)}
    >
      <p className={`text-4xl md:text-5xl font-black mb-2 tracking-tighter font-sans transition-all group-active:scale-110 ${colorClass}`}>
        {count}{suffix}
      </p>
      <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] font-sans leading-tight group-hover:text-indigo-600 transition-colors">
        {label}
      </p>
    </div>
  )
}

// Relevant line-art illustrations drawn inline (always load, no external deps).
const Illustrations = {
  // "Land your first remote job" — a laptop, an upward growth arrow, and a
  // work-from-anywhere location pin.
  remoteJob: (
    <svg viewBox="0 0 240 200" fill="none" className="w-3/4 max-w-[280px]" stroke="white" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
      {/* laptop */}
      <rect x="48" y="70" width="120" height="76" rx="6" opacity="0.95" />
      <path d="M36 156 h144 l-10 -10 H46 z" fill="white" fillOpacity="0.15" />
      {/* rising bars + arrow on screen */}
      <path d="M66 128 v-14 M86 128 v-26 M106 128 v-40" opacity="0.9" />
      <path d="M60 108 l24 -22 l18 12 l30 -34" opacity="0.95" />
      <path d="M120 64 h20 v20" opacity="0.95" />
      {/* location pin (work from anywhere) */}
      <path d="M188 40 a20 20 0 1 1 -40 0 c0 -14 20 -34 20 -34 s20 20 20 34 z" opacity="0.9" />
      <circle cx="168" cy="40" r="7" fill="white" />
    </svg>
  ),
  // "Which remote model" — three branching paths / nodes: micro, freelance,
  // full-time — a decision fork.
  remoteModels: (
    <svg viewBox="0 0 240 200" fill="none" className="w-3/4 max-w-[280px]" stroke="white" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
      {/* root node */}
      <circle cx="120" cy="40" r="16" fill="white" fillOpacity="0.15" />
      {/* branches */}
      <path d="M120 56 C120 90 56 96 56 128 M120 56 C120 100 120 100 120 128 M120 56 C120 90 184 96 184 128" opacity="0.85" />
      {/* three model nodes */}
      <rect x="34" y="128" width="44" height="44" rx="10" fill="white" fillOpacity="0.15" />
      <rect x="98" y="128" width="44" height="44" rx="10" fill="white" fillOpacity="0.15" />
      <rect x="162" y="128" width="44" height="44" rx="10" fill="white" fillOpacity="0.15" />
      {/* tiny icons inside */}
      <path d="M50 150 h12 M56 144 v12" opacity="0.9" />
      <circle cx="120" cy="150" r="7" opacity="0.9" />
      <path d="M176 150 h16" opacity="0.9" />
    </svg>
  ),
}

const ArticleCard = ({ category, readTime, title, excerpt, link, gradientClass, badgeText, illustration, imageUrl }) => {
  const [imgFailed, setImgFailed] = useState(false)
  const showPhoto = imageUrl && !imgFailed

  return (
  <div className="max-w-6xl mx-auto bg-white border border-slate-200 rounded-[4rem] overflow-hidden flex flex-col md:flex-row shadow-sm hover:shadow-xl transition-all duration-500 group mb-20">
    <div className={`w-full md:w-1/2 relative min-h-[400px] p-12 flex items-center justify-center overflow-hidden ${gradientClass}`}>
      {/* Real photo (falls back to the illustration if it fails to load) */}
      {showPhoto && (
        <img
          src={imageUrl}
          alt={title}
          onError={() => setImgFailed(true)}
          className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
        />
      )}
      {/* Dark gradient overlay for badge legibility (over photo) */}
      {showPhoto && <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-slate-950/20 to-transparent" />}

      {/* Fallback decoration + illustration when no photo */}
      {!showPhoto && (
        <>
          <div className="absolute inset-0 opacity-20">
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[150%] h-[150%] border-[40px] border-white rounded-full"></div>
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[100%] h-[100%] border-[40px] border-white rounded-full"></div>
          </div>
          <div className="relative z-10 flex items-center justify-center transition-transform duration-700 group-hover:scale-105">
            {illustration && Illustrations[illustration]}
          </div>
        </>
      )}

      {/* Badge pinned bottom-left */}
      <div className="absolute bottom-8 left-8 z-10 bg-slate-900/30 backdrop-blur-md border border-white/20 px-5 py-2 rounded-full text-[10px] font-black text-white uppercase tracking-[0.4em]">
        {badgeText || 'FEATURED ARTICLE'}
      </div>
    </div>

    <div className="w-full md:w-1/2 p-12 md:p-20 flex flex-col justify-center">
      <div className="flex items-center gap-3 mb-8">
        <span className="text-[10px] font-black text-indigo-600 uppercase tracking-[0.4em] font-sans">{category}</span>
        <span className="w-1 h-1 bg-slate-400 rounded-full"></span>
        <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.4em] font-sans">{readTime}</span>
      </div>

      <h2 className="text-3xl md:text-5xl font-black text-slate-900 mb-8 leading-tight tracking-tighter uppercase">
        {title}
      </h2>

      <p className="text-slate-500 text-lg leading-relaxed mb-12 font-sans font-medium">
        {excerpt}
      </p>

      <Link href={link} className="text-sm font-black text-slate-900 uppercase tracking-widest border-b-2 border-slate-900 pb-1 hover:text-indigo-600 hover:border-indigo-600 transition-all flex items-center w-fit font-sans">
        READ ARTICLE
        <svg className="w-4 h-4 ml-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
        </svg>
      </Link>
    </div>
  </div>
  )
}

export default function BlogPage() {
  const [activeCategory, setActiveCategory] = useState('ALL')

  const stats = [
    { value: '50', suffix: 'K+', label: 'REMOTE PROFESSIONALS', color: 'text-slate-900' },
    { value: '500', suffix: '+', label: 'COMPANIES HIRING', color: 'text-slate-900' },
    { value: '1', suffix: 'K+', label: 'JOBS POSTED', color: 'text-slate-900' },
    { value: '150', suffix: '+', label: 'COUNTRIES SUPPORTED', color: 'text-slate-900' }
  ]

  const categories = ['ALL', 'CAREER TIPS', 'SKILLS & DEVELOPMENT']

  return (
    <div className="bg-white min-h-screen pt-48 pb-24 font-serif">
      {/* SECTION 1: HERO */}
      <section className="container mx-auto px-4 mb-20">
        <div className="max-w-6xl mx-auto">
          <h1 className="text-5xl md:text-7xl font-black text-slate-900 mb-16 leading-tight tracking-tighter">
            Remote work, <br />
            simplified for you.
          </h1>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 mb-12">
            <p className="text-slate-700 text-lg leading-relaxed font-sans">
              Career tips, industry trends, and practical guides to help you land remote jobs, grow your skills, and build a thriving career from anywhere in the world.
            </p>
            <div>
              <p className="text-slate-700 text-lg leading-relaxed mb-8 font-sans">
                Stay ahead of the remote job market with expert insights from the JobStream team — written for real people building real careers.
              </p>
              <Link href="#articles" className="text-sm font-black text-slate-900 uppercase tracking-widest border-b-2 border-slate-900 pb-1 hover:text-indigo-600 hover:border-indigo-600 transition-all flex items-center w-fit font-sans">
                EXPLORE ALL ARTICLES
                <svg className="w-4 h-4 ml-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                </svg>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 2: STATS */}
      <section className="border-t border-b border-slate-200 py-16 mb-20">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {stats.map((stat, i) => (
              <StatItem
                key={i}
                initialValue={stat.value}
                suffix={stat.suffix}
                label={stat.label}
                colorClass={stat.color}
              />
            ))}
          </div>
        </div>
      </section>

      {/* SECTION 3: CATEGORIES */}
      <section className="container mx-auto px-4 mb-16" id="articles">
        <div className="flex flex-wrap justify-center gap-4">
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`px-8 py-3 rounded-xl text-[10px] font-black uppercase tracking-[0.4em] transition-all border font-sans ${
                activeCategory === cat
                  ? 'bg-slate-900 border-slate-900 text-white'
                  : 'bg-white border-slate-300 text-slate-500 hover:border-slate-900 hover:text-slate-900'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </section>

      {/* SECTION 4: ARTICLES LIST */}
      <section className="container mx-auto px-4 pb-32">
        {/* Article 1 */}
        <ArticleCard
          category="CAREER TIPS"
          readTime="2 min read"
          title="5 Tips to Land Your First Remote Job in 2026"
          excerpt="Breaking into remote work isn't as hard as it seems but it does require the right strategy. Here are five proven tips to help you land your first remote position faster."
          link="/blog/tips-to-land-first-remote-job"
          gradientClass="bg-gradient-to-br from-indigo-950 via-indigo-900 to-indigo-800"
          badgeText="FEATURED ARTICLE"
          illustration="remoteJob"
          imageUrl="https://images.unsplash.com/photo-1498050108023-c5249f4df085?auto=format&fit=crop&w=1000&q=80"
        />

        {/* Article 2 */}
        <ArticleCard
          category="INDUSTRY TRENDS"
          readTime="2 min read"
          title="Which Remote Model Is Right For You?"
          excerpt="Not all remote work is the same. Before jumping in, you need to understand the three main models — Micro-jobs, Freelance, and Full-time — and pick the one that fits your life."
          link="/blog/remote-work-models"
          gradientClass="bg-gradient-to-br from-purple-950 via-purple-900 to-indigo-950"
          badgeText="TRENDING NOW"
          illustration="remoteModels"
          imageUrl="https://images.unsplash.com/photo-1521737604893-d14cc237f11d?auto=format&fit=crop&w=1000&q=80"
        />
      </section>
    </div>
  )
}
