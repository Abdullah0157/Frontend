import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getSupabaseServer } from '@/lib/supabase/server'
import { query } from '@/lib/db'

// Handles both email confirmation links and OAuth callbacks.
// The `next` destination is carried via the `auth_next` cookie set before the
// OAuth roundtrip — this keeps the redirectTo URL itself clean so Supabase's
// exact-match allowlist validation passes without needing dashboard wildcards.
//
// First-time users (no resume in user_profiles) get sent to /profile?onboarding=1
// regardless of their requested `next` — they have to finish onboarding first.
export async function GET(req) {
  const url = new URL(req.url)
  const code = url.searchParams.get('code')

  const cookieStore = cookies()
  const nextFromCookie = cookieStore.get('auth_next')?.value
  const next = decodeURIComponent(nextFromCookie || url.searchParams.get('next') || '/jobs')

  const supabase = getSupabaseServer()
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
      // 1. Pending company signup → write the company_profile.
      //    (Signed up via /signup/company; pending_company cookie has the form data.)
      const pendingRaw = cookieStore.get('pending_company')?.value
      if (pendingRaw) {
        try {
          const data = JSON.parse(decodeURIComponent(pendingRaw))
          if (data?.company_name) {
            await query(
              `INSERT INTO user_profiles (user_id, account_type)
               VALUES ($1, 'company')
               ON CONFLICT (user_id) DO UPDATE SET account_type = 'company', updated_at = now()`,
              [user.id]
            )
            await query(
              `INSERT INTO company_profiles (user_id, company_name, website, industry, description, logo_url, updated_at)
               VALUES ($1, $2, $3, $4, $5, $6, now())
               ON CONFLICT (user_id) DO UPDATE SET
                 company_name = EXCLUDED.company_name,
                 website = EXCLUDED.website,
                 industry = EXCLUDED.industry,
                 description = EXCLUDED.description,
                 logo_url = EXCLUDED.logo_url,
                 updated_at = now()`,
              [user.id, data.company_name, data.website || null, data.industry || null, data.description || null, data.logo_url || null]
            )
          }
        } catch (e) {
          console.warn('pending_company write failed:', e.message)
        }
      }

      // 2. Look up the account type to decide destination.
      const { rows: profRows } = await query(
        `SELECT account_type FROM user_profiles WHERE user_id = $1`,
        [user.id]
      )
      const accountType = profRows[0]?.account_type || 'candidate'

      if (accountType === 'super_admin') {
        // Super admins always go to /admin regardless of ?next=. Their
        // workspace is separate from anything a `next` link could point at.
        finalNext = '/admin'
      } else if (accountType === 'company') {
        // Companies always land on /company (their dashboard).
        const { rows: compRows } = await query(`SELECT 1 FROM company_profiles WHERE user_id = $1 LIMIT 1`, [user.id])
        finalNext = compRows.length === 0 ? '/company?onboarding=1' : '/company'
      } else {
        // Candidates: onboarding gate (resume on file?)
        const { rows: resRows } = await query(
          `SELECT 1 FROM user_profiles WHERE user_id = $1 AND resume_text IS NOT NULL LIMIT 1`,
          [user.id]
        )
        finalNext = resRows.length === 0
          ? `/profile?onboarding=1&next=${encodeURIComponent(next)}`
          : next
      }
    }
  } catch (e) {
    console.warn('role routing check failed (allowing through):', e.message)
  }

  const res = NextResponse.redirect(new URL(finalNext, url.origin))
  res.cookies.delete('auth_next')
  res.cookies.delete('pending_company')
  return res
}
