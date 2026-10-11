import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'

// Email links that carry a token hash (Supabase's recommended server-side
// flow). Unlike the default code flow, these work when the email is opened on
// another device or browser. Used by the "Reset Password" email template:
//   {{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery
const TYPES = new Set(['recovery', 'signup', 'invite', 'magiclink', 'email', 'email_change'])

export async function GET(req) {
  const url = new URL(req.url)
  const tokenHash = url.searchParams.get('token_hash')
  const type = url.searchParams.get('type')
  const dest = type === 'recovery' ? '/reset-password' : '/'
  if (!tokenHash || !TYPES.has(type)) return NextResponse.redirect(new URL('/reset-password', url.origin))

  // Session cookies must be written onto the response we return.
  const res = NextResponse.redirect(new URL(dest, url.origin))
  const cookieStore = cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet) { cookiesToSet.forEach(({ name, value, options }) => res.cookies.set(name, value, options)) },
      },
    }
  )
  const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash })
  if (error) {
    // The reset page explains expired links and offers a new one.
    return NextResponse.redirect(new URL(type === 'recovery' ? '/reset-password' : `/login?error=${encodeURIComponent(error.message)}`, url.origin))
  }
  return res
}
