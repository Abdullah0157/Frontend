'use client'

import { useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'

// Global top navigation progress bar (YouTube/GitHub style). Gives INSTANT
// feedback the moment a link is clicked, so navigation never feels dead — even
// when the destination's server component is still loading. Pure client, no deps.
export default function NavProgress() {
  const pathname = usePathname()
  const [width, setWidth] = useState(0)
  const [visible, setVisible] = useState(false)
  const tick = useRef(null)
  const active = useRef(false)

  function start() {
    if (active.current) return
    active.current = true
    setVisible(true)
    let w = 10
    setWidth(w)
    clearInterval(tick.current)
    // Ease toward 90% while we wait for the route to resolve.
    tick.current = setInterval(() => {
      w += (92 - w) * 0.14
      setWidth(w)
    }, 180)
  }

  function done() {
    if (!active.current) return
    active.current = false
    clearInterval(tick.current)
    setWidth(100)
    setTimeout(() => { setVisible(false); setWidth(0) }, 220)
  }

  // Start on any internal link click (capture phase → fires before navigation).
  useEffect(() => {
    function onClick(e) {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
      const a = e.target?.closest?.('a')
      if (!a) return
      const href = a.getAttribute('href')
      if (!href || href.startsWith('#') || href.startsWith('http') || href.startsWith('mailto:') || a.target === '_blank' || a.hasAttribute('download')) return
      if (href === pathname) return // same page → no nav
      start()
    }
    document.addEventListener('click', onClick, true)
    return () => document.removeEventListener('click', onClick, true)
  }, [pathname])

  // The route actually changed → finish the bar.
  useEffect(() => { done() }, [pathname]) // eslint-disable-line react-hooks/exhaustive-deps

  // Safety: never let the bar hang forever.
  useEffect(() => {
    if (!visible) return
    const t = setTimeout(() => done(), 8000)
    return () => clearTimeout(t)
  }, [visible]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => () => clearInterval(tick.current), [])

  return (
    <div
      aria-hidden
      style={{
        position: 'fixed', top: 0, left: 0, height: 2.5, zIndex: 9999,
        width: `${width}%`,
        opacity: visible ? 1 : 0,
        background: 'linear-gradient(90deg, #6366f1, #818cf8)',
        boxShadow: '0 0 8px rgba(99,102,241,0.6)',
        transition: 'width 180ms ease-out, opacity 220ms ease-out',
        pointerEvents: 'none',
      }}
    />
  )
}
