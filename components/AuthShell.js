'use client'

import Link from 'next/link'
import Image from 'next/image'

// Shared chrome for every auth screen (candidate + company, sign in + sign up).
//
// These four pages had drifted into four different looks — different heading
// treatments, radii from 2xl to 2.5rem, and all-caps labels with 0.3-0.4em
// tracking that read as a marketing banner rather than a product. Putting the
// shell in one place means a change lands everywhere and they can't diverge again.

export const authInput =
  'w-full px-4 py-2.5 rounded-xl border border-slate-300 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none transition'

export const authLabel = 'block text-sm font-medium text-slate-700 mb-1.5'

export const authPrimaryBtn =
  'w-full px-5 py-3 rounded-xl bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800 active:bg-slate-950 transition disabled:opacity-60 disabled:cursor-not-allowed'

export const authSecondaryBtn =
  'w-full flex items-center justify-center gap-2.5 px-5 py-3 rounded-xl border border-slate-300 hover:bg-slate-50 active:bg-slate-100 transition text-sm font-semibold text-slate-700 disabled:opacity-60 disabled:cursor-not-allowed'

export function AuthError({ children }) {
  if (!children) return null
  return (
    <div className="mb-5 flex gap-2.5 p-3.5 rounded-xl border border-red-200 bg-red-50 text-sm text-red-700">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0 mt-px">
        <circle cx="12" cy="12" r="10" /><path d="M12 8v4M12 16h.01" strokeLinecap="round" />
      </svg>
      <span>{children}</span>
    </div>
  )
}

export function AuthDivider({ label = 'or' }) {
  return (
    <div className="relative my-6">
      <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-200" /></div>
      <div className="relative flex justify-center"><span className="bg-white px-3 text-xs text-slate-400">{label}</span></div>
    </div>
  )
}

export function GoogleButton({ loading, onClick, label = 'Continue with Google' }) {
  return (
    <button type="button" onClick={onClick} disabled={loading} className={authSecondaryBtn}>
      {loading ? (
        <svg className="w-[18px] h-[18px] animate-spin text-slate-400" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
        </svg>
      ) : (
        <svg className="w-[18px] h-[18px]" viewBox="0 0 24 24">
          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
        </svg>
      )}
      {loading ? 'Redirecting…' : label}
    </button>
  )
}

// Password field with a visibility toggle — typing a password blind on a phone
// is a real cause of failed sign-ins.
export function PasswordField({ id = 'password', label = 'Password', value, onChange, show, onToggle, autoComplete = 'current-password', placeholder = '••••••••', hint }) {
  return (
    <div>
      <label htmlFor={id} className={authLabel}>{label}</label>
      <div className="relative">
        <input
          id={id}
          type={show ? 'text' : 'password'}
          required
          autoComplete={autoComplete}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          className={`${authInput} pr-11`}
        />
        <button
          type="button"
          onClick={onToggle}
          aria-label={show ? 'Hide password' : 'Show password'}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition"
        >
          {show ? (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19M1 1l22 22" />
            </svg>
          ) : (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" />
            </svg>
          )}
        </button>
      </div>
      {hint && <p className="text-xs text-slate-400 mt-1.5">{hint}</p>}
    </div>
  )
}

export default function AuthShell({ title, subtitle, children, footer }) {
  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-16 bg-slate-50">
      <div className="w-full max-w-[420px]">
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2.5 mb-7">
            <Image src="/jobstream-icon.png" alt="" width={36} height={36} className="rounded-xl" priority />
            <span className="text-lg font-black tracking-tight text-slate-900">JobStream</span>
          </Link>
          <h1 className="text-[26px] font-bold tracking-tight text-slate-900">{title}</h1>
          {subtitle && <p className="text-sm text-slate-500 mt-1.5">{subtitle}</p>}
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-7 shadow-sm">{children}</div>

        {footer && <p className="text-center text-sm text-slate-500 mt-6">{footer}</p>}
      </div>
    </div>
  )
}
