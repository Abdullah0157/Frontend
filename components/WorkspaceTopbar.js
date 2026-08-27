'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { getSupabaseBrowser } from '@/lib/supabase/client'

// Top bar for the signed-in workspaces (candidate dashboard, company).
//
// The workspaces use a narrow ICON-ONLY sidebar, which left logged-in users with
// no visible branding and no obvious way to reach their account or sign out —
// the public site had a header but every signed-in page hid it. This restores a
// header where it was missing, without duplicating the sidebar's navigation.
export default function WorkspaceTopbar({ email, roleLabel = 'Candidate', homeHref = '/dashboard' }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const menuRef = useRef(null)

  const initials = (email || 'U').slice(0, 2).toUpperCase()

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
    <header className="sticky top-0 z-30 h-16 bg-white/90 backdrop-blur border-b border-slate-200 flex items-center justify-between gap-4 px-4 md:px-8 pl-20 md:pl-8">
      {/* Brand — the icon rail has no wordmark, so this is the only place the
          product name appears once you're signed in. */}
      <Link href={homeHref} className="flex items-center gap-2.5 min-w-0">
        <Image src="/jobstream-icon.png" alt="" width={28} height={28} className="rounded-lg shrink-0" />
        <span className="text-[15px] font-black tracking-tight text-slate-900 hidden sm:block">JobStream</span>
      </Link>

      <div className="relative shrink-0" ref={menuRef}>
        <button
          onClick={() => setOpen((o) => !o)}
          className="flex items-center gap-3 pl-1.5 pr-2.5 py-1.5 rounded-full hover:bg-slate-100 transition-colors"
          aria-haspopup="menu"
          aria-expanded={open}
        >
          <span className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-black text-[11px]">
            {initials}
          </span>
          <span className="text-left leading-tight hidden sm:block max-w-[180px]">
            <span className="block text-sm font-semibold text-slate-900 truncate">{email || 'Account'}</span>
            <span className="block text-[11px] text-slate-400 font-medium">{roleLabel}</span>
          </span>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
            strokeLinecap="round" strokeLinejoin="round"
            className={`text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`}>
            <path d="M6 9l6 6 6-6" />
          </svg>
        </button>

        {open && (
          <div role="menu" className="absolute right-0 mt-2 w-56 rounded-xl border border-slate-200 bg-white shadow-lg py-1.5 z-40">
            <p className="px-4 py-2 text-[11px] text-slate-400 border-b border-slate-100 truncate sm:hidden">{email}</p>
            <Link href="/dashboard/profile" onClick={() => setOpen(false)}
              className="block px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50">
              Profile
            </Link>
            <Link href="/dashboard/profile?tab=account" onClick={() => setOpen(false)}
              className="block px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50">
              Account settings
            </Link>
            <button onClick={logout}
              className="w-full text-left px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 border-t border-slate-100 mt-1">
              Log out
            </button>
          </div>
        )}
      </div>
    </header>
  )
}
