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
      <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] font-sans leading-tight group-hover:text-indigo-600 transition-colors">
        {label}
      </p>
    </div>
  )
}

const ArticleCard = ({ category, readTime, title, excerpt, link, gradientClass, badgeText }) => (
  <div className="max-w-6xl mx-auto bg-slate-50 rounded-[4rem] overflow-hidden flex flex-col md:flex-row shadow-sm hover:shadow-xl transition-all duration-500 group mb-20">
    <div className={`w-full md:w-1/2 relative min-h-[400px] p-12 flex items-center justify-center overflow-hidden ${gradientClass}`}>
      <div className="absolute inset-0 opacity-20">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[150%] h-[150%] border-[40px] border-white rounded-full"></div>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[100%] h-[100%] border-[40px] border-white rounded-full"></div>
      </div>
      <div className="relative z-10 bg-white/10 backdrop-blur-md border border-white/20 px-6 py-2 rounded-full text-[10px] font-black text-white uppercase tracking-[0.4em] transform translate-y-32 group-hover:translate-y-0 transition-all duration-700">
        {badgeText || 'FEATURED ARTICLE'}
      </div>
    </div>

    <div className="w-full md:w-1/2 p-12 md:p-20 flex flex-col justify-center">
      <div className="flex items-center gap-3 mb-8">
        <span className="text-[10px] font-black text-indigo-600 uppercase tracking-[0.4em] font-sans">{category}</span>
        <span className="w-1 h-1 bg-slate-300 rounded-full"></span>
        <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.4em] font-sans">{readTime}</span>
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
            <p className="text-slate-600 text-lg leading-relaxed font-sans">
              Career tips, industry trends, and practical guides to help you land remote jobs, grow your skills, and build a thriving career from anywhere in the world.
            </p>
            <div>
              <p className="text-slate-600 text-lg leading-relaxed mb-8 font-sans">
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
      <section className="border-t border-b border-slate-100 py-16 mb-20">
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
                  : 'bg-white border-slate-200 text-slate-400 hover:border-slate-900 hover:text-slate-900'
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
        />
      </section>
    </div>
  )
}
