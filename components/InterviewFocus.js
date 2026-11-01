'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

// Keeps an AI interview in front of the candidate: full screen, this tab.
// Leaving (another tab or window, or out of full screen) covers the interview
// until they come back, and each time goes to the server for the hiring team.
// The third time, or more than 30 seconds away in total, ends the interview
// (onLimit). Same limits as lib/interview-record.js FOCUS_LIMITS.
const LIMIT_LEAVES = 3
const LIMIT_AWAY_MS = 30000
// A moment out of focus (a notification, a click on the browser bar) is not
// counted unless it lasts this long.
const GRACE_MS = 1500

const fullscreenSupported = () => typeof document !== 'undefined' && Boolean(document.documentElement.requestFullscreen)

export function enterFullscreen() {
  if (!fullscreenSupported() || document.fullscreenElement) return Promise.resolve()
  return document.documentElement.requestFullscreen().catch(() => {})
}

export function useInterviewFocus({ active, onLimit }) {
  const [away, setAway] = useState(false)
  const [leaves, setLeaves] = useState(0)
  const pending = useRef([])          // events not yet sent to the server
  const awayMs = useRef(0)
  const awaySince = useRef(null)      // when the current absence started
  const counted = useRef(false)       // the current absence has been counted
  const graceTimer = useRef(null)
  const limitHit = useRef(false)
  const onLimitRef = useRef(onLimit)
  onLimitRef.current = onLimit

  const hitLimit = useCallback(() => {
    if (limitHit.current) return
    limitHit.current = true
    onLimitRef.current?.()
  }, [])

  useEffect(() => {
    if (!active) return undefined
    const isAway = () => document.hidden || !document.hasFocus() || (fullscreenSupported() && !document.fullscreenElement)

    const check = () => {
      if (isAway()) {
        if (awaySince.current != null) return
        awaySince.current = Date.now()
        counted.current = false
        setAway(true)
        clearTimeout(graceTimer.current)
        graceTimer.current = setTimeout(() => {
          if (awaySince.current == null) return
          counted.current = true
          pending.current.push({ kind: 'left' })
          setLeaves((n) => {
            if (n + 1 >= LIMIT_LEAVES) hitLimit()
            return n + 1
          })
        }, GRACE_MS)
      } else if (awaySince.current != null) {
        const ms = Date.now() - awaySince.current
        awaySince.current = null
        clearTimeout(graceTimer.current)
        if (counted.current) {
          awayMs.current += ms
          pending.current.push({ kind: 'back', ms })
          if (awayMs.current > LIMIT_AWAY_MS) hitLimit()
        }
        setAway(false)
      }
    }
    // While away, the total keeps growing: end the interview once it passes the limit.
    const tick = setInterval(() => {
      if (awaySince.current != null && counted.current && awayMs.current + (Date.now() - awaySince.current) > LIMIT_AWAY_MS) {
        pending.current.push({ kind: 'back', ms: Date.now() - awaySince.current })
        awayMs.current += Date.now() - awaySince.current
        awaySince.current = Date.now()
        hitLimit()
      }
    }, 1000)

    document.addEventListener('visibilitychange', check)
    document.addEventListener('fullscreenchange', check)
    window.addEventListener('blur', check)
    window.addEventListener('focus', check)
    check()
    return () => {
      document.removeEventListener('visibilitychange', check)
      document.removeEventListener('fullscreenchange', check)
      window.removeEventListener('blur', check)
      window.removeEventListener('focus', check)
      clearInterval(tick)
      clearTimeout(graceTimer.current)
    }
  }, [active, hitLimit])

  // Events since the last call, to send with the next request.
  const takeEvents = useCallback(() => pending.current.splice(0), [])

  return { away: active && away, leaves, takeEvents }
}

// The cover shown while the candidate is away from the interview.
export function FocusCover({ leaves, aiName = 'The interviewer' }) {
  const left = Math.max(0, LIMIT_LEAVES - leaves)
  return (
    <div role="alertdialog" aria-modal="true" aria-labelledby="focus-cover-title" className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/95 p-6">
      <div className="max-w-md rounded-2xl bg-white p-8 text-center shadow-2xl">
        <h2 id="focus-cover-title" className="text-xl font-bold text-slate-900">Come back to your interview</h2>
        <p className="mt-3 text-sm text-slate-600">
          {aiName} is waiting. Please stay in this tab and in full screen until the interview ends.
        </p>
        <p className="mt-3 text-sm font-medium text-amber-700">
          {leaves === 0
            ? 'Leaving 3 times, or for more than 30 seconds in total, ends the interview.'
            : `You have left the interview ${leaves} time${leaves > 1 ? 's' : ''}. ${left > 0 ? `${left} more ends it.` : ''}`}
        </p>
        <button
          type="button"
          onClick={() => { enterFullscreen(); window.focus() }}
          className="mt-6 w-full rounded-xl bg-indigo-600 py-3 text-sm font-semibold text-white hover:bg-indigo-700"
        >
          Return to the interview
        </button>
      </div>
    </div>
  )
}
