'use client'

// Shared mobile drawer chrome for the dashboard sidebars.
// - MobileMenuButton: a hamburger/close toggle, fixed top-left, hidden on md+.
// - MobileBackdrop: a dim backdrop shown while the drawer is open, hidden on md+.

export default function MobileMenuButton({ open, onToggle, tone = 'light' }) {
  const base =
    tone === 'dark'
      ? 'bg-slate-900 border-slate-700 text-white'
      : 'bg-white border-slate-200 text-slate-700'
  return (
    <button
      onClick={onToggle}
      aria-label={open ? 'Close menu' : 'Open menu'}
      className={`md:hidden fixed top-4 left-4 z-[70] w-11 h-11 rounded-xl border shadow-md flex items-center justify-center ${base}`}
    >
      {open ? (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 6L6 18M6 6l12 12" />
        </svg>
      ) : (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 12h18M3 6h18M3 18h18" />
        </svg>
      )}
    </button>
  )
}

export function MobileBackdrop({ open, onClose }) {
  if (!open) return null
  return <div className="md:hidden fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[55]" onClick={onClose} />
}
