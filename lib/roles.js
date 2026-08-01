// Role helpers — role stored as user_profiles.account_type.
// Values: 'super_admin' | 'company' | 'candidate'
//
// Promote a user to super_admin manually with:
//   UPDATE user_profiles SET account_type = 'super_admin' WHERE user_id = '<uuid>';
//
// New signups default to 'candidate' via the DB schema; company signup flow
// sets 'company'; there is intentionally no self-serve path to 'super_admin'.

import { redirect } from 'next/navigation'
import { getSupabaseServer } from './supabase/server'
import { query } from './db'

export const ROLES = Object.freeze({
  SUPER_ADMIN: 'super_admin',
  COMPANY: 'company',
  CANDIDATE: 'candidate',
})

// Where each role's home dashboard lives. Used both by post-login redirects
// and by requireRole() when it needs to send a wrong-role user elsewhere.
export function dashboardFor(role) {
  if (role === ROLES.SUPER_ADMIN) return '/admin'
  if (role === ROLES.COMPANY) return '/company'
  return '/dashboard'
}

// Fetch the current user + their role in one call. Returns {user, role} or
// {user: null, role: null} if not logged in.
export async function getUserWithRole() {
  const supabase = getSupabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { user: null, role: null }
  const res = await query(
    'SELECT account_type FROM user_profiles WHERE user_id = $1 LIMIT 1',
    [user.id]
  ).catch(() => null)
  const role = res?.rows?.[0]?.account_type || ROLES.CANDIDATE
  return { user, role }
}

// Pure predicate — check if a role matches any of the allowed values.
export function hasRole(role, ...allowed) {
  return allowed.includes(role)
}

// Server-component gate — call at the top of a page.js to require a role.
// If not logged in → /login. If logged in with wrong role → their own dashboard.
// Returns { user, role } for the caller to use.
//
// Usage in a server component:
//   export default async function AdminPage() {
//     const { user } = await requireRole(ROLES.SUPER_ADMIN)
//     return <div>...</div>
//   }
export async function requireRole(...allowed) {
  const { user, role } = await getUserWithRole()
  if (!user) redirect('/login')
  if (!hasRole(role, ...allowed)) redirect(dashboardFor(role))
  return { user, role }
}
