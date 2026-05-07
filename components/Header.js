'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

export default function Header() {
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [isScrolled, setIsScrolled] = useState(false)

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20)
    }
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  return (
    <header className={`fixed top-0 z-50 transition-all duration-500 w-full ${isScrolled ? 'bg-indigo-950/90 shadow-2xl backdrop-blur-md border-b border-white/10' : 'bg-gradient-to-r from-blue-600/80 via-indigo-900/80 to-slate-950/80 text-white border-b border-white/10'}`}>
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-24">
          {/* Logo */}
          <div className="flex-shrink-0 flex items-center">
            <Link href="/" className="flex items-center space-x-3 group">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-gradient-to-br from-blue-500 to-indigo-600 shadow-2xl shadow-indigo-500/40 group-hover:scale-110 transition-transform duration-300">
                <span className="text-white font-black text-xl tracking-tighter">JS</span>
              </div>
              <span className="nav-link text-2xl font-black tracking-tighter text-white">JOBSTREAM</span>
            </Link>
          </div>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex space-x-12 items-center">
            <Link href="/" className="nav-link font-black text-xs uppercase tracking-[0.3em] text-white hover:text-blue-300 transition-colors">Home</Link>
            <Link href="/about" className="nav-link font-black text-xs uppercase tracking-[0.3em] text-white hover:text-blue-300 transition-colors">About Us</Link>
            <Link href="/blog" className="nav-link font-black text-xs uppercase tracking-[0.3em] text-white hover:text-blue-300 transition-colors">Blog</Link>
            <Link href="/jobs" className="nav-link font-black text-xs uppercase tracking-[0.3em] text-white hover:text-blue-300 transition-colors">Find Jobs</Link>
            
            {/* LinkedIn Link */}
            <a 
              href="https://www.linkedin.com/company/jobstream-opportunity" 
              target="_blank" 
              rel="noopener noreferrer"
              className="p-2 bg-white/10 hover:bg-white/20 rounded-lg transition-all border border-white/10 group"
            >
              <svg className="w-5 h-5 text-white group-hover:text-blue-400 transition-colors" fill="currentColor" viewBox="0 0 24 24">
                <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.761 0 5-2.239 5-5v-14c0-2.761-2.239-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z" />
              </svg>
            </a>
          </nav>

          {/* Mobile menu button */}
          <div className="md:hidden flex items-center text-white">
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="hover:text-blue-300 focus:outline-none"
            >
              <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                {isMenuOpen ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Navigation */}
      {isMenuOpen && (
        <div className="md:hidden bg-indigo-950/95 py-6 animate-slide-down shadow-2xl backdrop-blur-xl border-b border-white/10">
          <div className="container mx-auto px-4 space-y-4">
            <Link href="/" className="block text-white font-black text-xs uppercase tracking-[0.3em] py-3 border-b border-white/10">Home</Link>
            <Link href="/about" className="block text-white font-black text-xs uppercase tracking-[0.3em] py-3 border-b border-white/10">About Us</Link>
            <Link href="/blog" className="block text-white font-black text-xs uppercase tracking-[0.3em] py-3 border-b border-white/10">Blog</Link>
            <Link href="/jobs" className="block text-white font-black text-xs uppercase tracking-[0.3em] py-3 border-b border-white/10">Find Jobs</Link>
            <a href="https://www.linkedin.com/company/jobstream-opportunity" target="_blank" className="block text-blue-400 font-black text-xs uppercase tracking-[0.3em] py-3">LinkedIn</a>
          </div>
        </div>
      )}
    </header>
  )
}
