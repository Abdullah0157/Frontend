'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter, usePathname } from 'next/navigation'
import { getSupabaseBrowser } from '@/lib/supabase/client'

export default function Header() {
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [isScrolled, setIsScrolled] = useState(false)
  const [user, setUser] = useState(null)
  const [accountType, setAccountType] = useState('candidate')
  const [authReady, setAuthReady] = useState(false)
  const router = useRouter()
  const pathname = usePathname()

  const hideHeader = /^\/(jobs|interview)\/.+\/interview$|^\/interview\/.+$/.test(pathname || '')

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 20)
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  // Pull both auth state and account_type. /api/me handles the role lookup.
  useEffect(() => {
    const supabase = getSupabaseBrowser()
    async function refresh() {
      const { data: { user: u } } = await supabase.auth.getUser()
      setUser(u || null)
      if (u) {
        try {
          const res = await fetch('/api/me', { cache: 'no-store' })
          const data = res.ok ? await res.json() : null
          setAccountType(data?.accountType || 'candidate')
        } catch { setAccountType('candidate') }
      } else {
        setAccountType('candidate')
      }
      setAuthReady(true)
    }
    refresh()
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) refresh()
      else { setUser(null); setAccountType('candidate'); setAuthReady(true) }
    })
    return () => subscription.unsubscribe()
  }, [])

  async function logout() {
    const supabase = getSupabaseBrowser()
    await supabase.auth.signOut()
    setIsMenuOpen(false)
    router.push('/')
    router.refresh()
  }

  if (hideHeader) return null

  const isCompany = user && accountType === 'company'
  const isCandidate = user && accountType === 'candidate'
  const isGuest = !user

  // Build role-specific nav links
  const navLinks = [
    { href: '/', label: 'Home', show: true },
    { href: '/about', label: 'About', show: true },
    { href: '/blog', label: 'Blog', show: true },
    { href: '/jobs', label: 'Find Jobs', show: isGuest || isCandidate },
    { href: '/company', label: 'For Companies', show: isGuest },
    { href: '/company', label: 'Dashboard', show: isCompany },
    { href: '/company/candidates', label: 'Candidates', show: isCompany },
  ]

  return (
    <header className={`fixed top-0 z-50 transition-all duration-500 w-full ${isScrolled ? 'bg-slate-950/95 shadow-2xl backdrop-blur-md border-b border-slate-800' : 'bg-slate-950/80 backdrop-blur-md border-b border-slate-900'}`}>
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-24">
          <div className="flex-shrink-0 flex items-center">
            <Link href="/" className="flex items-center space-x-3 group">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-gradient-to-br from-blue-500 to-indigo-600 shadow-2xl shadow-indigo-500/40 group-hover:scale-110 transition-transform duration-300">
                <span className="text-white font-black text-xl tracking-tighter">JS</span>
              </div>
              <span className="text-2xl font-black tracking-tighter text-white">JOBSTREAM</span>
            </Link>
          </div>

          <nav className="hidden md:flex space-x-10 items-center">
            {navLinks.filter((l) => l.show).map((l) => (
              <Link key={l.href + l.label} href={l.href} className="nav-link font-black text-xs uppercase tracking-[0.3em] text-slate-300 hover:text-indigo-400 transition-colors">
                {l.label}
              </Link>
            ))}

            {authReady && (user ? (
              <div className="flex items-center gap-3 pl-4 border-l border-slate-800">
                {isCandidate && (
                  <Link href="/profile" className="text-xs font-black uppercase tracking-[0.3em] text-slate-300 hover:text-indigo-400">
                    Profile
                  </Link>
                )}
                <button onClick={logout} className="text-xs font-black uppercase tracking-widest px-4 py-2 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700">
                  Log out
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-3 pl-4 border-l border-slate-800">
                <Link href="/login" className="text-xs font-black uppercase tracking-[0.3em] text-slate-300 hover:text-indigo-400">
                  Log in
                </Link>
                <Link href="/signup" className="text-xs font-black uppercase tracking-widest px-4 py-2 rounded-full bg-indigo-600 text-white hover:bg-indigo-500">
                  Sign up
                </Link>
              </div>
            ))}
          </nav>

          <div className="md:hidden flex items-center text-slate-200">
            <button onClick={() => setIsMenuOpen(!isMenuOpen)} className="hover:text-indigo-400 focus:outline-none">
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

      {isMenuOpen && (
        <div className="md:hidden bg-slate-950/95 py-6 animate-slide-down shadow-2xl backdrop-blur-xl border-b border-slate-800">
          <div className="container mx-auto px-4 space-y-3">
            {navLinks.filter((l) => l.show).map((l) => (
              <Link key={l.href + l.label} href={l.href} className="block text-slate-200 font-black text-xs uppercase tracking-[0.3em] py-3 border-b border-slate-800">
                {l.label}
              </Link>
            ))}
            {authReady && (user ? (
              <>
                {isCandidate && (
                  <Link href="/profile" className="block text-slate-200 font-black text-xs uppercase tracking-[0.3em] py-3 border-b border-slate-800">Profile</Link>
                )}
                <button onClick={logout} className="block w-full text-left text-indigo-400 font-black text-xs uppercase tracking-[0.3em] py-3">Log out</button>
              </>
            ) : (
              <>
                <Link href="/login" className="block text-slate-200 font-black text-xs uppercase tracking-[0.3em] py-3 border-b border-slate-800">Log in</Link>
                <Link href="/signup" className="block text-indigo-400 font-black text-xs uppercase tracking-[0.3em] py-3">Sign up</Link>
              </>
            ))}
          </div>
        </div>
      )}
    </header>
  )
}
