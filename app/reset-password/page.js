'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import AuthShell, { AuthError, PasswordField, authPrimaryBtn } from '@/components/AuthShell'
import { getSupabaseBrowser } from '@/lib/supabase/client'

const MIN_LENGTH = 8

// Opened from the reset email: the link has already signed the user in for
// this purpose, so all that is left is choosing the new password.
export default function ResetPasswordPage() {
  const router = useRouter()
  const [ready, setReady] = useState(null) // null = checking, false = no valid link
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [show, setShow] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  useEffect(() => {
    getSupabaseBrowser().auth.getUser()
      .then(({ data }) => setReady(Boolean(data?.user)))
      .catch(() => setReady(false))
  }, [])

  async function onSubmit(e) {
    e.preventDefault()
    setError('')
    if (password.length < MIN_LENGTH) return setError(`Please use at least ${MIN_LENGTH} characters.`)
    if (password !== confirm) return setError('The two passwords do not match.')
    setLoading(true)
    try {
      const { error: err } = await getSupabaseBrowser().auth.updateUser({ password })
      if (err) {
        setError(/different from the old/i.test(err.message)
          ? 'Please choose a password different from your old one.'
          : 'Could not save the new password. Please request a new link and try again.')
        return
      }
      setDone(true)
      // The home page sends each account type to its own dashboard.
      setTimeout(() => router.replace('/'), 1500)
    } finally {
      setLoading(false)
    }
  }

  if (ready === null) {
    return <AuthShell title="Choose a new password"><p className="text-sm text-slate-500">Checking your link…</p></AuthShell>
  }
  if (!ready) {
    return (
      <AuthShell
        title="This link has expired"
        footer={<Link href="/login" className="font-semibold text-indigo-600 hover:text-indigo-700">Back to sign in</Link>}
      >
        <div className="text-sm text-slate-700 space-y-4">
          <p>
            Reset links work once, for a limited time, and in the browser where you asked for them. Please ask for a
            new link.
          </p>
          <Link href="/forgot-password" className={`${authPrimaryBtn} inline-flex justify-center`}>Send a new link</Link>
        </div>
      </AuthShell>
    )
  }
  return (
    <AuthShell title="Choose a new password" subtitle={done ? undefined : `At least ${MIN_LENGTH} characters.`}>
      {done ? (
        <p className="text-sm text-slate-700" role="status">Your password has been changed. Taking you to your account…</p>
      ) : (
        <form onSubmit={onSubmit} className="space-y-4">
          <AuthError>{error}</AuthError>
          <PasswordField
            id="new-password"
            label="New password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            show={show}
            onToggle={() => setShow((s) => !s)}
            autoComplete="new-password"
          />
          <PasswordField
            id="confirm-password"
            label="Confirm new password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            show={show}
            onToggle={() => setShow((s) => !s)}
            autoComplete="new-password"
          />
          <button type="submit" disabled={loading} className={authPrimaryBtn}>
            {loading ? 'Saving…' : 'Save new password'}
          </button>
        </form>
      )}
    </AuthShell>
  )
}
