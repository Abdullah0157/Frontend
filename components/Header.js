'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter, usePathname } from 'next/navigation'
import { getSupabaseBrowser } from '@/lib/supabase/client'

// Site header (design option A). Hidden inside the dashboards and interviews,
// which have their own chrome.
export default function Header() {
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [user, setUser] = useState(null)
  const [accountType, setAccountType] = useState('candidate')
  const [authReady, setAuthReady] = useState(false)
  const router = useRouter()
  const pathname = usePathname()

  const hideHeader =
    /^\/jobs\/.+\/interview$|^\/interview\/[^/]+\/session/.test(pathname || '') ||
    /^\/(dashboard|company|admin)(\/|$)/.test(pathname || '')

  // Close the phone menu after navigating.
  useEffect(() => { setIsMenuOpen(false) }, [pathname])

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
  const isAdmin = user && accountType === 'super_admin'
  const isGuest = !user

  const navLinks = [
    { href: '/#companies', label: 'For companies', show: isGuest },
    { href: '/#candidates', label: 'For candidates', show: isGuest },
    { href: '/jobs', label: 'Find jobs', show: isGuest || isCandidate },
    { href: '/dashboard', label: 'My dashboard', show: isCandidate },
    { href: '/company', label: 'Dashboard', show: isCompany },
    { href: '/company/candidates', label: 'Candidates', show: isCompany },
    { href: '/admin', label: 'Admin', show: isAdmin },
    { href: '/blog', label: 'Blog', show: isGuest },
  ].filter((l) => l.show)

  const linkClass = 'text-[15px] text-body hover:text-ink transition-colors'
  const primaryBtn = 'inline-flex items-center justify-center rounded-[10px] bg-brand px-4 py-2.5 text-[15px] font-semibold text-white hover:bg-brand-dark transition-colors'
  const secondaryBtn = 'inline-flex items-center justify-center rounded-[10px] border border-[#CDD2DA] bg-white px-4 py-2.5 text-[15px] font-semibold text-ink hover:bg-surface transition-colors'

  return (
    <header className="fixed top-0 z-50 w-full border-b border-line bg-white/95 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-[1200px] items-center gap-8 px-6">
        <Link href="/" className="flex items-center gap-2.5 text-ink">
          <img src="/jobstream-icon.png" alt="" className="h-8 w-8 object-contain" />
          <span className="text-[19px] font-bold tracking-tight">JobStream</span>
        </Link>

        <nav aria-label="Main" className="hidden flex-1 items-center gap-7 md:flex">
          {navLinks.map((l) => (
            <Link key={l.href} href={l.href} className={linkClass}>{l.label}</Link>
          ))}
        </nav>

        <div className="ml-auto hidden items-center gap-3 md:flex">
          {authReady && (user ? (
            <button type="button" onClick={logout} className={secondaryBtn}>Log out</button>
          ) : (
            <>
              <Link href="/login" className="px-1.5 py-2.5 text-[15px] font-medium text-ink hover:text-brand">Sign in</Link>
              <Link href="/signup/company" className={primaryBtn}>Post a job</Link>
            </>
          ))}
        </div>

        <button
          type="button"
          onClick={() => setIsMenuOpen(!isMenuOpen)}
          aria-label={isMenuOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={isMenuOpen}
          className="ml-auto inline-flex h-11 w-11 items-center justify-center rounded-lg text-ink hover:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand md:hidden"
        >
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
            {isMenuOpen ? (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            )}
          </svg>
        </button>
      </div>

      {isMenuOpen && (
        <div className="border-t border-line bg-white md:hidden">
          <nav aria-label="Main" className="mx-auto flex max-w-[1200px] flex-col px-6 py-3">
            {navLinks.map((l) => (
              <Link key={l.href} href={l.href} className="border-b border-line py-3.5 text-base text-ink">{l.label}</Link>
            ))}
            {authReady && (user ? (
              <button type="button" onClick={logout} className={`${secondaryBtn} mt-4`}>Log out</button>
            ) : (
              <div className="mt-4 flex flex-col gap-3">
                <Link href="/signup/company" className={primaryBtn}>Post a job</Link>
                <Link href="/login" className={secondaryBtn}>Sign in</Link>
              </div>
            ))}
          </nav>
        </div>
      )}
    </header>
  )
}
