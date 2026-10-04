// Shared plumbing for the written-assessment API routes: who is asking, may
// they touch this session, and turning errors into JSON responses.

import { NextResponse } from 'next/server'
import { getUserWithRole, ROLES } from './roles'
import { loadSession, canAccess, AssessmentError } from './written-assessment'

export const TOKEN_HEADER = 'x-assessment-token'

export async function currentUser() {
  try {
    return await getUserWithRole()
  } catch {
    return { user: null, role: null }
  }
}

// Loads the session and checks access. Super admins may read any session.
export async function authorizedSession(req, sessionId, { allowAdmin = false } = {}) {
  const session = await loadSession(sessionId)
  const { user, role } = await currentUser()
  const token = req.headers.get(TOKEN_HEADER)
  const isAdmin = allowAdmin && role === ROLES.SUPER_ADMIN
  if (!isAdmin && !canAccess(session, { token, userId: user?.id })) {
    throw new AssessmentError('you do not have access to this assessment', 403, 'forbidden')
  }
  return { session, user, role, isAdmin }
}

export function errorResponse(e, where) {
  if (e instanceof AssessmentError) {
    return NextResponse.json({ error: e.message, code: e.code }, { status: e.status })
  }
  console.error(`${where} error:`, e)
  return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 })
}
