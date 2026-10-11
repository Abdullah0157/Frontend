'use client'

import { useState } from 'react'
import Link from 'next/link'
import AuthShell, { AuthError, authInput, authLabel, authPrimaryBtn } from '@/components/AuthShell'
import { getSupabaseBrowser } from '@/lib/supabase/client'

// Sends a password reset link. The answer is the same whether or not the email
// has an account, so the page cannot be used to find out who is registered.
export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function onSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      // The link comes back through /auth/callback (already allowed in
      // Supabase); this cookie tells it to open the new-password page.
      document.cookie = `auth_next=${encodeURIComponent('/reset-password')}; path=/; max-age=3600; samesite=lax`
      const { error: err } = await getSupabaseBrowser().auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/auth/callback`,
      })
      // Only a rate limit is worth showing; anything else would reveal
      // whether the account exists.
      if (err && /security purposes|rate limit|after \d+ seconds/i.test(err.message)) {
        setError('Please wait a minute before asking for another link.')
      } else {
        setSent(true)
      }
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthShell
      title="Reset your password"
      subtitle={sent ? undefined : 'Enter your email and we will send you a link to choose a new password.'}
      footer={<>Remembered it? <Link href="/login" className="font-semibold text-indigo-600 hover:text-indigo-700">Back to sign in</Link></>}
    >
      {sent ? (
        <div className="text-sm text-slate-700 space-y-3" role="status">
          <p className="font-semibold text-slate-900">Check your email</p>
          <p>
            If an account exists for <span className="font-medium">{email.trim()}</span>, we have sent a link to reset
            your password. It can take a few minutes; check your spam folder too.
          </p>
          <p className="text-slate-500">For best results, open the link on this device and in this browser.</p>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="space-y-4">
          <AuthError>{error}</AuthError>
          <div>
            <label htmlFor="email" className={authLabel}>Email</label>
            <input
              id="email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className={authInput}
            />
          </div>
          <button type="submit" disabled={loading} className={authPrimaryBtn}>
            {loading ? 'Sending…' : 'Send reset link'}
          </button>
        </form>
      )}
    </AuthShell>
  )
}
