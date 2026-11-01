'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

// Gives a candidate one more interview attempt (for a real technical problem).
export default function GiveAttemptButton({ userId, jobId = null, label = 'Give one more attempt' }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function give() {
    setBusy(true)
    setError('')
    try {
      const res = await fetch('/api/admin/interview-attempts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, jobId }),
      })
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Could not give the attempt.')
      router.refresh()
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <span className="inline-flex items-center gap-2">
      <button type="button" onClick={give} disabled={busy} className="rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50">
        {busy ? 'Giving…' : label}
      </button>
      {error && <span role="alert" className="text-xs text-red-600">{error}</span>}
    </span>
  )
}
