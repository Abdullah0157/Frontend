'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { getSupabaseBrowser } from '@/lib/supabase/client'
import MobileMenuButton, { MobileBackdrop } from '@/components/MobileMenuButton'

const NAV = [
  { href: '/company',            label: 'Dashboard',  icon: 'M3 12l9-9 9 9M5 10v10h14V10' },
  { href: '/company/jobs',       label: 'Jobs',       icon: 'M9 4h6v3H9V4zm-5 5h16v12H4V9zm5 4h6v2H9v-2z' },
  { href: '/company/candidates', label: 'Candidates', icon: 'M16 11a4 4 0 10-8 0 4 4 0 008 0zM4 21a8 8 0 0116 0H4z' },
  { href: '/company/settings',   label: 'Settings',   icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.591 1.071c1.504-.866 3.299.929 2.433 2.433a1.724 1.724 0 001.07 2.591c1.757.426 1.757 2.924 0 3.35a1.724 1.724 0 00-1.07 2.591c.865 1.504-.929 3.299-2.433 2.433a1.724 1.724 0 00-2.591 1.07c-.426 1.757-2.924 1.757-3.35 0a1.724 1.724 0 00-2.591-1.07c-1.504.866-3.299-.929-2.433-2.433a1.724 1.724 0 00-1.07-2.591c-1.757-.426-1.757-2.924 0-3.35a1.724 1.724 0 001.07-2.591c-.866-1.504.929-3.299 2.433-2.433.99.572 2.25.072 2.591-1.071zM12 15a3 3 0 100-6 3 3 0 000 6z' },
]

export default function CompanySidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const [companyName, setCompanyName] = useState('')
  const [email, setEmail] = useState('')
  const [open, setOpen] = useState(false)

  useEffect(() => {
    fetch('/api/me', { cache: 'no-store' })
      .then((r) => r.ok ? r.json() : null)
      .then((d) => {
        setCompanyName(d?.companyName || 'Company')
        setEmail(d?.user?.email || '')
      })
      .catch(() => {})
  }, [])

  // Close the mobile drawer on navigation.
  useEffect(() => { setOpen(false) }, [pathname])

  async function logout() {
    const supabase = getSupabaseBrowser()
    await supabase.auth.signOut()
    router.push('/')
    router.refresh()
  }

  function isActive(href) {
    if (href === '/company') return pathname === '/company'
    return pathname === href || pathname.startsWith(`${href}/`)
  }

  return (
    <>
    <MobileMenuButton open={open} onToggle={() => setOpen((o) => !o)} />
    <MobileBackdrop open={open} onClose={() => setOpen(false)} />
    <aside className={`fixed top-0 left-0 z-[60] h-screen w-64 bg-white border-r border-slate-200 flex flex-col transform transition-transform duration-300 md:translate-x-0 ${open ? 'translate-x-0' : '-translate-x-full'}`}>
      {/* Brand */}
      <Link href="/company" className="flex items-center gap-3 px-6 py-7 border-b border-slate-200 hover:bg-slate-50 transition">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-gradient-to-br from-blue-500 to-indigo-600 shadow-lg shadow-indigo-500/30">
          <span className="text-white font-black text-base tracking-tighter">JS</span>
        </div>
        <div className="min-w-0">
          <p className="text-slate-900 font-black text-sm uppercase tracking-tight truncate">{companyName}</p>
          <p className="text-slate-400 text-[10px] uppercase tracking-widest">Company</p>
        </div>
      </Link>

      {/* Nav */}
      <nav className="flex-1 px-3 py-6 space-y-1 overflow-y-auto">
        {NAV.map((item) => {
          const active = isActive(item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition ${
                active
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/30'
                  : 'text-slate-700 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d={item.icon} />
              </svg>
              {item.label}
            </Link>
          )
        })}
      </nav>

      {/* User footer */}
      <div className="px-3 py-4 border-t border-slate-200">
        <div className="flex items-center gap-3 px-2 py-2 mb-2">
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-emerald-500 to-emerald-700 flex items-center justify-center text-white font-black text-xs">
            {(email[0] || '?').toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-slate-700 text-xs font-black truncate">{email || 'Loading…'}</p>
            <p className="text-slate-400 text-[10px]">Company admin</p>
          </div>
        </div>
        <button
          onClick={logout}
          className="w-full text-xs font-black uppercase tracking-widest px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 transition"
        >
          Log out
        </button>
      </div>
    </aside>
    </>
  )
}
