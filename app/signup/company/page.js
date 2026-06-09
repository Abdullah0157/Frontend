'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { getSupabaseBrowser } from '@/lib/supabase/client'

const INDUSTRIES = [
  'Software / SaaS', 'AI / ML', 'E-commerce', 'Fintech', 'Healthcare',
  'Education', 'Media / Entertainment', 'Marketing / Advertising', 'Consulting',
  'Legal', 'Manufacturing', 'Logistics', 'Real Estate', 'Other',
]

export default function CompanySignupPage() {
  const router = useRouter()
  const [form, setForm] = useState({
    email: '',
    password: '',
    company_name: '',
    website: '',
    industry: '',
    description: '',
    logo_url: '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  function stashCompanyCookie() {
    document.cookie = `pending_company=${encodeURIComponent(JSON.stringify({
      company_name: form.company_name.trim(),
      website: form.website.trim(),
      industry: form.industry,
      description: form.description.trim(),
      logo_url: form.logo_url.trim(),
    }))}; path=/; max-age=3600; samesite=lax`
  }

  async function onSubmit(e) {
    e.preventDefault()
    if (form.password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }
    if (!form.company_name.trim()) {
      setError('Company name is required.')
      return
    }
    setLoading(true)
    setError('')
    try {
      const supabase = getSupabaseBrowser()
      stashCompanyCookie()

      const { error: signupErr } = await supabase.auth.signUp({
        email: form.email,
        password: form.password,
        options: {
          data: { account_type: 'company', company_name: form.company_name.trim() },
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      })
      if (signupErr) throw signupErr
      setSuccess(true)
    } catch (e) {
      setError(e.message || 'Sign-up failed')
    } finally {
      setLoading(false)
    }
  }

  async function signUpWithGoogle() {
    if (!form.company_name.trim()) {
      setError('Enter a company name first — we link it to your Google account.')
      return
    }
    setError('')
    try {
      stashCompanyCookie()
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

  if (success) {
    return (
      <div className="min-h-screen pt-32 pb-24 px-4">
        <div className="container mx-auto max-w-md">
          <div className="bg-slate-900 border border-emerald-800 rounded-[2.5rem] p-10 shadow-xl text-center">
            <span className="inline-block px-4 py-1.5 rounded-full bg-emerald-950/40 text-emerald-400 font-black text-[10px] uppercase tracking-[0.4em] mb-4">
              Check your email
            </span>
            <h1 className="text-2xl font-black text-white mb-3">Almost there</h1>
            <p className="text-slate-300 text-sm leading-relaxed">
              We sent a confirmation link to <strong className="text-white">{form.email}</strong>. Click it to verify, then log in to start posting jobs.
            </p>
            <Link href="/login/company" className="inline-block mt-6 text-xs font-black uppercase tracking-widest text-indigo-400 hover:text-indigo-300">
              → Go to company login
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen pt-32 pb-24 px-4">
      <div className="container mx-auto max-w-2xl">
        <div className="text-center mb-8">
          <span className="inline-block px-4 py-1.5 rounded-full bg-indigo-950/40 border border-indigo-900 text-indigo-400 font-black text-[10px] uppercase tracking-[0.4em] mb-4">
            For Companies
          </span>
          <h1 className="text-3xl md:text-4xl font-black uppercase tracking-tight text-white">
            Hire smarter <span className="text-indigo-400">with AI</span>
          </h1>
          <p className="text-slate-400 mt-3 text-sm">
            Create a company account to post jobs and review AI-screened candidates.
          </p>
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-2xl border border-red-800 bg-red-950/40 text-red-400 text-sm">{error}</div>
        )}

        <form onSubmit={onSubmit} className="bg-slate-900 border border-slate-800 rounded-[2.5rem] p-8 shadow-xl shadow-indigo-500/5 space-y-5">
          <div className="grid md:grid-cols-2 gap-5">
            <label className="block">
              <span className="text-xs font-black uppercase tracking-[0.3em] text-slate-300">Company Name *</span>
              <input
                type="text"
                required
                value={form.company_name}
                onChange={(e) => setForm({ ...form, company_name: e.target.value })}
                placeholder="Acme Corp"
                className="mt-2 w-full px-5 py-4 rounded-2xl border border-slate-700 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-900 outline-none transition"
              />
            </label>
            <label className="block">
              <span className="text-xs font-black uppercase tracking-[0.3em] text-slate-300">Industry</span>
              <select
                value={form.industry}
                onChange={(e) => setForm({ ...form, industry: e.target.value })}
                className="mt-2 w-full px-5 py-4 rounded-2xl border border-slate-700 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-900 outline-none transition"
              >
                <option value="">Select…</option>
                {INDUSTRIES.map((i) => <option key={i} value={i}>{i}</option>)}
              </select>
            </label>
          </div>

          <label className="block">
            <span className="text-xs font-black uppercase tracking-[0.3em] text-slate-300">Website</span>
            <input
              type="url"
              value={form.website}
              onChange={(e) => setForm({ ...form, website: e.target.value })}
              placeholder="https://acme.com"
              className="mt-2 w-full px-5 py-4 rounded-2xl border border-slate-700 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-900 outline-none transition"
            />
          </label>

          <label className="block">
            <span className="text-xs font-black uppercase tracking-[0.3em] text-slate-300">Logo URL</span>
            <input
              type="url"
              value={form.logo_url}
              onChange={(e) => setForm({ ...form, logo_url: e.target.value })}
              placeholder="https://acme.com/logo.png"
              className="mt-2 w-full px-5 py-4 rounded-2xl border border-slate-700 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-900 outline-none transition"
            />
          </label>

          <label className="block">
            <span className="text-xs font-black uppercase tracking-[0.3em] text-slate-300">Short Description</span>
            <textarea
              rows={3}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="One or two sentences candidates will see when reviewing your jobs."
              className="mt-2 w-full px-5 py-4 rounded-2xl border border-slate-700 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-900 outline-none transition resize-y"
            />
          </label>

          <div className="border-t border-slate-800 pt-5 space-y-5">
            <label className="block">
              <span className="text-xs font-black uppercase tracking-[0.3em] text-slate-300">Work Email *</span>
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
              <span className="text-xs font-black uppercase tracking-[0.3em] text-slate-300">Password *</span>
              <input
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                placeholder="At least 8 characters"
                className="mt-2 w-full px-5 py-4 rounded-2xl border border-slate-700 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-900 outline-none transition"
              />
            </label>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn-style-9 w-full justify-center group uppercase tracking-widest text-xs !px-12 !py-5 rounded-full font-black disabled:opacity-60"
          >
            <div className="btn-shimmer"></div>
            <span>{loading ? 'Creating company…' : 'Create Company Account'}</span>
          </button>

          <div className="relative my-2">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-700" /></div>
            <div className="relative flex justify-center text-[10px] font-black uppercase tracking-widest"><span className="bg-slate-900 px-3 text-slate-400">or</span></div>
          </div>

          <button
            type="button"
            onClick={signUpWithGoogle}
            className="w-full flex items-center justify-center gap-3 px-5 py-4 rounded-2xl border border-slate-700 hover:bg-slate-800 transition text-sm font-bold text-slate-200"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Sign up with Google
          </button>

          <p className="text-center text-xs text-slate-400 pt-2">
            Already have a company account?{' '}
            <Link href="/login/company" className="font-black text-indigo-400 hover:text-indigo-300">
              Log in
            </Link>
            <span className="text-slate-600"> · </span>
            Looking for jobs?{' '}
            <Link href="/signup" className="font-black text-indigo-400 hover:text-indigo-300">
              Candidate signup
            </Link>
          </p>
        </form>
      </div>
    </div>
  )
}
