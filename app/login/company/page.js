'use client'

import { useState, Suspense } from 'react'
import Link from 'next/link'
import AuthShell, { AuthError, AuthDivider, GoogleButton, PasswordField, authInput, authLabel, authPrimaryBtn } from '@/components/AuthShell'
import { useRouter, useSearchParams } from 'next/navigation'
import { getSupabaseBrowser } from '@/lib/supabase/client'

function CompanyLoginInner() {
  const router = useRouter()
  const params = useSearchParams()
  const next = params.get('next') || '/company'

  const [form, setForm] = useState({ email: '', password: '' })
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [error, setError] = useState('')
  const [showPassword, setShowPassword] = useState(false)

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
    setGoogleLoading(true)
    try {
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

  return (
    <AuthShell
      title="Company sign in"
      subtitle="Manage your roles, candidates and interviews."
      footer={
        <>
          New company?{' '}
          <Link href="/signup/company" className="font-semibold text-indigo-600 hover:text-indigo-700">Create an account</Link>
          <span className="text-slate-300"> · </span>
          <Link href="/login" className="font-semibold text-indigo-600 hover:text-indigo-700">Candidate sign in</Link>
        </>
      }
    >
      <AuthError>{error}</AuthError>

      <GoogleButton loading={googleLoading} onClick={signInWithGoogle} />
      <AuthDivider label="or sign in with email" />

      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <label htmlFor="email" className={authLabel}>Work email</label>
          <input
            id="email"
            type="email"
            required
            autoComplete="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            placeholder="hiring@acme.com"
            className={authInput}
          />
        </div>
        <PasswordField
          value={form.password}
          onChange={(e) => setForm({ ...form, password: e.target.value })}
          show={showPassword}
          onToggle={() => setShowPassword((s) => !s)}
        />
        <button type="submit" disabled={loading} className={authPrimaryBtn}>
          {loading ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </AuthShell>
  )
}

export default function CompanyLoginPage() {
  return (
    <Suspense>
      <CompanyLoginInner />
    </Suspense>
  )
}
