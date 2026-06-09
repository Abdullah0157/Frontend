'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { getSupabaseBrowser } from '@/lib/supabase/client'

export default function CompanyLoginPage() {
  const router = useRouter()
  const params = useSearchParams()
  const next = params.get('next') || '/company'

  const [form, setForm] = useState({ email: '', password: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function onSubmit(e) {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const supabase = getSupabaseBrowser()
      const { error: loginErr } = await supabase.auth.signInWithPassword({
        email: form.email,
        password: form.password,
      })
      if (loginErr) throw loginErr
      router.push(next)
      router.refresh()
    } catch (e) {
      setError(e.message || 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  async function signInWithGoogle() {
    setError('')
    try {
      const supabase = getSupabaseBrowser()
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: `${window.location.origin}/auth/callback` },
      })
      if (error) throw error
    } catch (e) {
      setError(e.message || 'Google sign-in failed')
    }
  }

  return (
    <div className="min-h-screen pt-32 pb-24 px-4">
      <div className="container mx-auto max-w-md">
        <div className="text-center mb-8">
          <span className="inline-block px-4 py-1.5 rounded-full bg-indigo-950/40 border border-indigo-900 text-indigo-400 font-black text-[10px] uppercase tracking-[0.4em] mb-4">
            Company Login
          </span>
          <h1 className="text-3xl md:text-4xl font-black uppercase tracking-tight text-white">
            Welcome back
          </h1>
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-2xl border border-red-800 bg-red-950/40 text-red-400 text-sm">{error}</div>
        )}

        <form onSubmit={onSubmit} className="bg-slate-900 border border-slate-800 rounded-[2.5rem] p-8 shadow-xl shadow-indigo-500/5 space-y-5">
          <label className="block">
            <span className="text-xs font-black uppercase tracking-[0.3em] text-slate-300">Work Email</span>
            <input
              type="email"
              required
              autoComplete="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="hiring@acme.com"
              className="mt-2 w-full px-5 py-4 rounded-2xl border border-slate-700 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-900 outline-none transition"
            />
          </label>
          <label className="block">
            <span className="text-xs font-black uppercase tracking-[0.3em] text-slate-300">Password</span>
            <input
              type="password"
              required
              autoComplete="current-password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              className="mt-2 w-full px-5 py-4 rounded-2xl border border-slate-700 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-900 outline-none transition"
            />
          </label>

          <button
            type="submit"
            disabled={loading}
            className="btn-style-9 w-full justify-center group uppercase tracking-widest text-xs !px-12 !py-5 rounded-full font-black disabled:opacity-60"
          >
            <div className="btn-shimmer"></div>
            <span>{loading ? 'Logging in…' : 'Log In'}</span>
          </button>

          <div className="relative my-2">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-700" /></div>
            <div className="relative flex justify-center text-[10px] font-black uppercase tracking-widest"><span className="bg-slate-900 px-3 text-slate-400">or</span></div>
          </div>

          <button
            type="button"
            onClick={signInWithGoogle}
            className="w-full flex items-center justify-center gap-3 px-5 py-4 rounded-2xl border border-slate-700 hover:bg-slate-800 transition text-sm font-bold text-slate-200"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Continue with Google
          </button>

          <p className="text-center text-xs text-slate-400 pt-2">
            New company?{' '}
            <Link href="/signup/company" className="font-black text-indigo-400 hover:text-indigo-300">
              Create company account
            </Link>
            <span className="text-slate-600"> · </span>
            Candidate?{' '}
            <Link href="/login" className="font-black text-indigo-400 hover:text-indigo-300">
              Candidate login
            </Link>
          </p>
        </form>
      </div>
    </div>
  )
}
