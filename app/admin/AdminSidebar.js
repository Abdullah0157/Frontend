'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { getSupabaseBrowser } from '@/lib/supabase/client'
import MobileMenuButton, { MobileBackdrop } from '@/components/MobileMenuButton'

// Narrow icon-rail nav — same clean white style as the candidate dashboard
// (centered icon + tiny label, indigo active state).
const NAV = [
  {
    href: '/admin', label: 'Home',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" />
        <rect x="3" y="14" width="7" height="7" /><rect x="14" y="14" width="7" height="7" />
      </svg>
    ),
  },
  {
    href: '/admin/companies', label: 'Companies',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 21h18M5 21V7l7-4 7 4v14M9 9h1M9 12h1M9 15h1M14 9h1M14 12h1M14 15h1" />
      </svg>
    ),
  },
  {
    href: '/admin/candidates', label: 'Candidates',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
  },
  {
    href: '/admin/interviews', label: 'Interviews',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      </svg>
    ),
  },
  {
    href: '/admin/expert-assessments', label: 'Rubrics',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 11l3 3L22 4M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
      </svg>
    ),
  },
  {
    href: '/admin/items', label: 'Items',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2l9 5-9 5-9-5 9-5zM3 12l9 5 9-5M3 17l9 5 9-5" />
      </svg>
    ),
  },
  {
    href: '/admin/skills', label: 'Skills',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="5" r="3" /><line x1="12" y1="8" x2="12" y2="14" />
        <circle cx="6" cy="17" r="3" /><circle cx="18" cy="17" r="3" />
        <line x1="8.5" y1="15.5" x2="10.5" y2="12" /><line x1="15.5" y1="15.5" x2="13.5" y2="12" />
      </svg>
    ),
  },
  {
    href: '/admin/analytics', label: 'Analytics',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" />
      </svg>
    ),
  },
]

export default function AdminSidebar({ email }) {
  const pathname = usePathname()
  const router = useRouter()
  const [open, setOpen] = useState(false)

  useEffect(() => { NAV.forEach((item) => router.prefetch(item.href)) }, [router])
  useEffect(() => { setOpen(false) }, [pathname])

  function isActive(href) {
    if (href === '/admin') return pathname === '/admin'
    return pathname === href || pathname.startsWith(`${href}/`)
  }

  async function logout() {
    const supabase = getSupabaseBrowser()
    await supabase.auth.signOut()
    router.push('/')
    router.refresh()
  }

  const initial = (email?.[0] || 'S').toUpperCase()

  return (
    <>
      <MobileMenuButton open={open} onToggle={() => setOpen((o) => !o)} />
      <MobileBackdrop open={open} onClose={() => setOpen(false)} />
      <aside
        className={`fixed top-0 left-0 z-[60] h-screen w-24 bg-white border-r border-slate-200/80 flex flex-col items-center transform transition-transform duration-300 md:translate-x-0 ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Logo */}
        <Link href="/admin" className="flex items-center justify-center h-[76px] flex-shrink-0">
          <img src="/jobstream-icon.png" alt="Jobstream" className="w-11 h-11 object-contain" />
        </Link>

        {/* Nav */}
        <nav className="flex-1 w-full px-2 py-3 space-y-1 overflow-y-auto">
          {NAV.map((item) => {
            const active = isActive(item.href)
            return (
              <Link
                key={item.href}
                href={item.href}
                className="flex flex-col items-center gap-1.5 py-2.5 rounded-2xl group"
              >
                <span
                  className={`w-12 h-9 rounded-xl flex items-center justify-center transition-colors ${
                    active ? 'bg-indigo-50 text-indigo-600' : 'text-slate-400 group-hover:text-slate-700 group-hover:bg-slate-50'
                  }`}
                >
                  {item.icon}
                </span>
                <span className={`text-[11px] font-semibold leading-none text-center ${active ? 'text-indigo-600' : 'text-slate-500 group-hover:text-slate-700'}`}>
                  {item.label}
                </span>
              </Link>
            )
          })}
        </nav>

        {/* Avatar + logout */}
        <div className="w-full px-2 py-4 flex flex-col items-center gap-2 flex-shrink-0 border-t border-slate-100">
          <div className="w-9 h-9 rounded-full bg-slate-900 flex items-center justify-center text-white font-semibold text-sm ring-1 ring-slate-900/5">
            {initial}
          </div>
          <span className="text-[11px] font-medium text-slate-500 truncate max-w-full px-1">Admin</span>
          <button
            onClick={logout}
            title="Log out"
            className="text-slate-400 hover:text-red-600 transition-colors"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><path d="M16 17l5-5-5-5M21 12H9" />
            </svg>
          </button>
        </div>
      </aside>
    </>
  )
}
