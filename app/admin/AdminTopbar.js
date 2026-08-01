'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { getSupabaseBrowser } from '@/lib/supabase/client'

// Top bar for the admin console: notifications bell + account dropdown
// (Profile / Settings / Log out), matching the CRM reference's top-right.
export default function AdminTopbar({ email }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const menuRef = useRef(null)

  const initials = (email || 'SA').slice(0, 2).toUpperCase()
  const name = 'Super Admin'

  useEffect(() => {
    function onClick(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  async function logout() {
    const supabase = getSupabaseBrowser()
    await supabase.auth.signOut()
    router.push('/')
    router.refresh()
  }

  return (
    <header className="sticky top-0 z-30 h-20 bg-white/90 backdrop-blur border-b border-slate-200 flex items-center justify-end gap-4 px-4 md:px-8 pl-20 md:pl-8">
      {/* Notifications */}
      <button className="relative w-10 h-10 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-500 transition-colors">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        <span className="absolute top-2 right-2.5 w-2 h-2 rounded-full bg-indigo-500 ring-2 ring-white" />
      </button>

      {/* Account dropdown */}
      <div className="relative" ref={menuRef}>
        <button
          onClick={() => setOpen((o) => !o)}
          className="flex items-center gap-3 pl-1.5 pr-3 py-1.5 rounded-full hover:bg-slate-100 transition-colors"
        >
          <span className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-black text-xs">
            {initials}
          </span>
          <span className="text-left leading-tight hidden sm:block">
            <span className="block text-sm font-bold text-slate-900">{name}</span>
            <span className="block text-[11px] text-slate-400 font-medium">Super Admin</span>
          </span>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={`text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`}>
            <path d="M6 9l6 6 6-6" />
          </svg>
        </button>

        {open && (
          <div className="absolute right-0 mt-2 w-60 rounded-2xl bg-white border border-slate-200 shadow-xl shadow-slate-900/5 overflow-hidden">
            <div className="px-4 py-4 border-b border-slate-100">
              <p className="text-sm font-bold text-slate-900">{name}</p>
              <p className="text-xs text-slate-500 truncate mt-0.5">{email}</p>
            </div>
            <div className="py-1.5">
              <Link href="/admin" onClick={() => setOpen(false)} className="flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>
                Dashboard
              </Link>
              <Link href="/" onClick={() => setOpen(false)} className="flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M9 22V12h6v10"/></svg>
                View public site
              </Link>
            </div>
            <div className="py-1.5 border-t border-slate-100">
              <button onClick={logout} className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50 transition-colors">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="M16 17l5-5-5-5M21 12H9"/></svg>
                Log out
              </button>
            </div>
          </div>
        )}
      </div>
    </header>
  )
}
