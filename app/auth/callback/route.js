import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { query } from '@/lib/db'

// Handles both email confirmation links and OAuth callbacks.
// The `next` destination is carried via the `auth_next` cookie set before the
// OAuth roundtrip — this keeps the redirectTo URL itself clean so Supabase's
// exact-match allowlist validation passes without needing dashboard wildcards.
//
// First-time users (no resume in user_profiles) get sent to /profile?onboarding=1
// regardless of their requested `next` — they have to finish onboarding first.
//
// IMPORTANT: the session cookies that exchangeCodeForSession() writes MUST be
// attached to the SAME response we return. Cookies set via next/headers cookies()
// are dropped when you return a manually-built NextResponse — which caused the
// "first Google login lands on home, second login works" bug. So we create the
// redirect response up front and bind Supabase's cookie writes to it.
export async function GET(req) {
  const url = new URL(req.url)
  const code = url.searchParams.get('code')

  const cookieStore = cookies()
  const nextFromCookie = cookieStore.get('auth_next')?.value
  // Default a plain login to the candidate dashboard (not /jobs).
  const next = decodeURIComponent(nextFromCookie || url.searchParams.get('next') || '/dashboard')

  // The response we'll return. Its Location is updated after role routing; the
  // Supabase client below writes the session cookies directly onto it.
  const res = NextResponse.redirect(new URL(next, url.origin))

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => res.cookies.set(name, value, options))
        },
      },
    }
  )

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (error) {
      console.error('exchangeCodeForSession failed', error)
      return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(error.message)}`, url.origin))
    }
  }

  // Role-aware routing.
  let finalNext = next
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      // Company accounts are invite-only (an admin grants them), so the old
      // "pending_company" cookie is ignored: anyone could set it by hand.

      // 2. Look up the account type to decide destination.
      const { rows: profRows } = await query(
        `SELECT account_type FROM user_profiles WHERE user_id = $1`,
        [user.id]
      ).catch(() => ({ rows: [] }))
      const accountType = profRows[0]?.account_type || 'candidate'

      if (accountType === 'super_admin') {
        finalNext = '/admin'
      } else if (accountType === 'company') {
        const { rows: compRows } = await query(`SELECT 1 FROM company_profiles WHERE user_id = $1 LIMIT 1`, [user.id]).catch(() => ({ rows: [] }))
        finalNext = compRows.length === 0 ? '/company?onboarding=1' : '/company'
      } else {
        // Candidates: onboarding gate (resume on file?)
        const { rows: resRows } = await query(
          `SELECT 1 FROM user_profiles WHERE user_id = $1 AND resume_text IS NOT NULL LIMIT 1`,
          [user.id]
        ).catch(() => ({ rows: [] }))
        finalNext = resRows.length === 0
          ? `/dashboard/profile?onboarding=1&next=${encodeURIComponent(next)}`
          : next   // respects an explicit destination (e.g. an interview link), else /dashboard
      }
    }
  } catch (e) {
    console.warn('role routing check failed (allowing through):', e.message)
  }

  // A password reset link always lands on the new-password page, whatever the
  // account type or onboarding state.
  if (next === '/reset-password') finalNext = '/reset-password'

  // Point the (cookie-carrying) response at the final destination.
  res.headers.set('location', new URL(finalNext, url.origin).toString())
  res.cookies.delete('auth_next')
  res.cookies.delete('pending_company')
  return res
}
