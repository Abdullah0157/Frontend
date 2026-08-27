'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { getSupabaseBrowser } from '@/lib/supabase/client'
import MobileMenuButton, { MobileBackdrop } from '@/components/MobileMenuButton'

// Narrow icon-rail nav (Mercor/AfterQuery style): centered icon + tiny label.
const NAV = [
  {
    href: '/dashboard', label: 'Home',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><path d="M9 22V12h6v10" />
      </svg>
    ),
  },
  {
    href: '/dashboard/jobs', label: 'Apply',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="7" width="20" height="14" rx="2" /><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" />
      </svg>
    ),
  },
  {
    href: '/dashboard/interviews', label: 'Interviews',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      </svg>
    ),
  },
  {
    href: '/dashboard/domain-expert', label: 'Expert',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z" /><path d="M19 10v1a7 7 0 0 1-14 0v-1M12 18v4M8 22h8" />
      </svg>
    ),
  },
  {
    href: '/dashboard/skills', label: 'Skills',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="12 2 15 9 22 9 16.5 13.5 18.5 21 12 16.5 5.5 21 7.5 13.5 2 9 9 9 12 2" />
      </svg>
    ),
  },
  {
    href: '/dashboard/profile', label: 'Profile',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
      </svg>
    ),
  },
]

export default function DashboardSidebar({ email }) {
  const pathname = usePathname()
  const router = useRouter()
  const [open, setOpen] = useState(false)

  useEffect(() => { NAV.forEach((item) => router.prefetch(item.href)) }, [router])
  useEffect(() => { setOpen(false) }, [pathname])

  function isActive(href) {
    if (href === '/dashboard') return pathname === '/dashboard'
    return pathname === href || pathname.startsWith(`${href}/`)
  }

  async function logout() {
    const supabase = getSupabaseBrowser()
    await supabase.auth.signOut()
    router.push('/')
    router.refresh()
  }

  const initial = (email?.[0] || 'U').toUpperCase()

  return (
    <>
      <MobileMenuButton open={open} onToggle={() => setOpen((o) => !o)} />
      <MobileBackdrop open={open} onClose={() => setOpen(false)} />
      <aside
        className={`fixed top-0 left-0 z-[60] h-screen w-24 bg-white border-r border-slate-200/80 flex flex-col items-center transform transition-transform duration-300 md:translate-x-0 ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Spacer aligning the first nav item with the topbar below it.
            The logo lives in the topbar so it isn't shown twice. */}
        <div className="h-4 flex-shrink-0" />

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

        {/* Identity and sign-out deliberately live in the topbar, not here.
            Having them in both places meant two logos and two log-out controls
            on the same screen. The rail is navigation only. */}
      </aside>
    </>
  )
}
