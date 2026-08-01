import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'

// Routes that require an authenticated user.
const PROTECTED_PREFIXES = ['/jobs', '/profile', '/company', '/interview', '/admin', '/dashboard']

// Routes that redirect already-logged-in users away.
const AUTH_PAGES = ['/login', '/signup', '/login/company', '/signup/company']

// Home page also sends logged-in users straight to the dashboard.
const HOME_PAGES = ['/']

// Role-scoped prefixes — enforcement happens in the individual page files
// via requireRole() from lib/roles.js. Middleware just makes sure you're
// logged in; the page decides if your role is allowed.
const ROLE_SCOPED = {
  '/admin':     'super_admin',
  '/company':   'company',
  '/dashboard': 'candidate',
}

function isProtected(pathname) {
  return PROTECTED_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`))
}
function isAuthPage(pathname) {
  return AUTH_PAGES.includes(pathname)
}
function isHomePage(pathname) {
  return HOME_PAGES.includes(pathname)
}
// Best-effort role redirect on the home page. Middleware runs on the Edge,
// so we can't hit the DB directly here — we use user_metadata.account_type
// which Supabase populates on signup + can be updated by our sync jobs.
function dashboardForMeta(metaAccountType) {
  if (metaAccountType === 'super_admin') return '/admin'
  if (metaAccountType === 'company')     return '/company'
  return '/dashboard'
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

  // Compute the user's role once if we have a session, so we can use it
  // for both the home/login redirect AND for role-gating protected routes.
  let accountType = null
  if (user) {
    accountType = user.user_metadata?.account_type || user.app_metadata?.account_type
    if (!accountType || accountType === 'candidate') {
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('account_type')
        .eq('user_id', user.id)
        .maybeSingle()
      if (profile?.account_type) accountType = profile.account_type
    }
    console.log(`[middleware] ${pathname} · user=${user.email} · role=${accountType}`)
  }

  if ((isAuthPage(pathname) || isHomePage(pathname)) && user) {
    const url = request.nextUrl.clone()
    url.pathname = dashboardForMeta(accountType)
    return NextResponse.redirect(url)
  }

  // Route super_admins away from candidate-facing pages. They have their own
  // workspace at /admin — landing them on /jobs (job seeker view) is wrong.
  if (user && accountType === 'super_admin' && (pathname === '/jobs' || pathname.startsWith('/jobs/') || pathname === '/profile' || pathname.startsWith('/profile/'))) {
    const url = request.nextUrl.clone()
    url.pathname = '/admin'
    return NextResponse.redirect(url)
  }

  // Candidates should manage their profile INSIDE the dashboard, never on the
  // public /profile onboarding page (which shows the marketing chrome). Send
  // them to /dashboard/profile, preserving query params (e.g. ?tab=resume).
  if (user && (accountType === 'candidate' || !accountType) && (pathname === '/profile' || pathname.startsWith('/profile/'))) {
    const url = request.nextUrl.clone()
    url.pathname = '/dashboard/profile'
    return NextResponse.redirect(url)
  }

  // Route super_admins landing on the candidate dashboard to admin too.
  if (user && accountType === 'super_admin' && pathname.startsWith('/dashboard')) {
    const url = request.nextUrl.clone()
    url.pathname = '/admin'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}
