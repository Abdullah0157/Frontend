'use client'

import { useState, Suspense } from 'react'
import Link from 'next/link'
import AuthShell, { AuthError, AuthDivider, GoogleButton, PasswordField, authInput, authLabel, authPrimaryBtn } from '@/components/AuthShell'
import { useRouter, useSearchParams } from 'next/navigation'
import { getSupabaseBrowser } from '@/lib/supabase/client'

function SignupInner() {
  const router = useRouter()
  const params = useSearchParams()
  const next = params.get('next') || '/jobs'

  const [form, setForm] = useState({ fullName: '', email: '', password: '' })
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [error, setError] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [success, setSuccess] = useState(false)

  async function onSubmit(e) {
    e.preventDefault()
    if (form.password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }
    setLoading(true)
    setError('')
    try {
      const supabase = getSupabaseBrowser()
      const { error: signupErr } = await supabase.auth.signUp({
        email: form.email,
        password: form.password,
        options: {
          data: { full_name: form.fullName },
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

  async function signInWithGoogle() {
    setError('')
    setGoogleLoading(true)
    try {
      document.cookie = `auth_next=${encodeURIComponent(next)}; path=/; max-age=600; samesite=lax`
      const supabase = getSupabaseBrowser()
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      })
      if (error) throw error
    } catch (e) {
      setError(e.message || 'Google sign-in failed')
      setGoogleLoading(false)
    }
  }

  if (success) {
    return (
      <AuthShell title="Check your email" subtitle="One quick step and you're in.">
        <div className="text-center">
          <span className="inline-flex w-12 h-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 mb-4">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 4h16v16H4z" /><path d="M22 6l-10 7L2 6" />
            </svg>
          </span>
          <p className="text-sm text-slate-600 leading-relaxed">
            We sent a confirmation link to <strong className="text-slate-900">{form.email}</strong>. Click it to verify your address, then come back and sign in.
          </p>
          <Link href="/login" className="inline-block mt-6 text-sm font-semibold text-indigo-600 hover:text-indigo-700">
            Go to sign in
          </Link>
        </div>
      </AuthShell>
    )
  }

  return (
    <AuthShell
      title="Create your account"
      subtitle="Upload your resume once, interview for any role."
      footer={
        <>
          Already have an account?{' '}
          <Link href={`/login${next ? `?next=${encodeURIComponent(next)}` : ''}`} className="font-semibold text-indigo-600 hover:text-indigo-700">
            Sign in
          </Link>
        </>
      }
    >
      <AuthError>{error}</AuthError>

      <GoogleButton loading={googleLoading} onClick={signInWithGoogle} label="Sign up with Google" />
      <AuthDivider label="or sign up with email" />

      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <label htmlFor="fullName" className={authLabel}>Full name</label>
          <input
            id="fullName"
            type="text"
            required
            autoComplete="name"
            value={form.fullName}
            onChange={(e) => setForm({ ...form, fullName: e.target.value })}
            placeholder="Jane Doe"
            className={authInput}
          />
        </div>
        <div>
          <label htmlFor="email" className={authLabel}>Email</label>
          <input
            id="email"
            type="email"
            required
            autoComplete="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            placeholder="you@example.com"
            className={authInput}
          />
        </div>
        <PasswordField
          value={form.password}
          onChange={(e) => setForm({ ...form, password: e.target.value })}
          show={showPassword}
          onToggle={() => setShowPassword((s) => !s)}
          autoComplete="new-password"
          placeholder="At least 8 characters"
          hint="Use at least 8 characters."
        />

        <button type="submit" disabled={loading} className={authPrimaryBtn}>
          {loading ? 'Creating account…' : 'Create account'}
        </button>
      </form>
    </AuthShell>
  )
}

export default function SignupPage() {
  return (
    <Suspense>
      <SignupInner />
    </Suspense>
  )
}
