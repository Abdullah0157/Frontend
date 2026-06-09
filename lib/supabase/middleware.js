import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'

// Routes that require an authenticated user.
const PROTECTED_PREFIXES = ['/jobs', '/profile', '/company', '/interview']

// Routes that redirect already-logged-in users away.
const AUTH_PAGES = ['/login', '/signup', '/login/company', '/signup/company']

function isProtected(pathname) {
  return PROTECTED_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`))
}
function isAuthPage(pathname) {
  return AUTH_PAGES.includes(pathname)
}

export async function updateSession(request) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  const { pathname } = request.nextUrl

  if (isProtected(pathname) && !user) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    url.searchParams.set('next', pathname)
    return NextResponse.redirect(url)
  }

  if (isAuthPage(pathname) && user) {
    const url = request.nextUrl.clone()
    // Don't know role at middleware-time without a DB hit. Bounce them to /
    // and let the home page link them onward; cheaper than per-request DB call.
    url.pathname = '/'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}
