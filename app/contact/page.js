'use client'

import { useState } from 'react'
import Link from 'next/link'
import AuthShell, { AuthError, authInput, authLabel, authPrimaryBtn } from '@/components/AuthShell'

// Companies are invite-only: they ask here, and we set up their account.
export default function ContactPage() {
  const [form, setForm] = useState({ name: '', company: '', email: '', phone: '', message: '', website: '' })
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })

  async function onSubmit(e) {
    e.preventDefault()
    setError('')
    setSending(true)
    try {
      const res = await fetch('/api/contact', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(form) })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) setError(data.error || 'Could not send your message. Please try again.')
      else setSent(true)
    } catch {
      setError('Could not send your message. Please try again.')
    } finally {
      setSending(false)
    }
  }

  return (
    <AuthShell
      title={sent ? 'Thank you' : 'Hire with JobStream'}
      subtitle={sent ? undefined : 'Tell us about your hiring needs and we will set up your company account.'}
      footer={<>Looking for a job? <Link href="/signup" className="font-semibold text-indigo-600 hover:text-indigo-700">Create a candidate account</Link></>}
    >
      {sent ? (
        <div className="text-sm text-slate-700 space-y-3" role="status">
          <p className="font-semibold text-slate-900">We have your message.</p>
          <p>We will reply to <span className="font-medium">{form.email}</span> soon to set up your company account and your first job.</p>
          <Link href="/" className={`${authPrimaryBtn} inline-flex justify-center`}>Back to the home page</Link>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="space-y-4">
          <AuthError>{error}</AuthError>
          <div>
            <label htmlFor="name" className={authLabel}>Your name</label>
            <input id="name" required autoComplete="name" value={form.name} onChange={set('name')} className={authInput} />
          </div>
          <div>
            <label htmlFor="company" className={authLabel}>Company</label>
            <input id="company" required autoComplete="organization" value={form.company} onChange={set('company')} className={authInput} />
          </div>
          <div>
            <label htmlFor="email" className={authLabel}>Work email</label>
            <input id="email" type="email" required autoComplete="email" value={form.email} onChange={set('email')} placeholder="you@company.com" className={authInput} />
          </div>
          <div>
            <label htmlFor="phone" className={authLabel}>Phone or WhatsApp <span className="text-slate-500 font-normal">(optional)</span></label>
            <input id="phone" type="tel" autoComplete="tel" value={form.phone} onChange={set('phone')} className={authInput} />
          </div>
          <div>
            <label htmlFor="message" className={authLabel}>What roles are you hiring for?</label>
            <textarea id="message" required rows={4} value={form.message} onChange={set('message')} placeholder="For example: 10 customer service agents with good English, starting next month." className={`${authInput} resize-y`} />
          </div>
          {/* Hidden from people; bots fill it in and are ignored. */}
          <div aria-hidden="true" className="absolute -left-[9999px] w-px h-px overflow-hidden">
            <label htmlFor="website">Website</label>
            <input id="website" tabIndex={-1} autoComplete="off" value={form.website} onChange={set('website')} />
          </div>
          <button type="submit" disabled={sending} className={authPrimaryBtn}>{sending ? 'Sending…' : 'Send message'}</button>
        </form>
      )}
    </AuthShell>
  )
}
