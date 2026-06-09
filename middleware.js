import { updateSession } from '@/lib/supabase/middleware'

export async function middleware(request) {
  return await updateSession(request)
}

export const config = {
  matcher: [
    // Run on everything except Next.js internals + static assets.
    '/((?!_next/static|_next/image|favicon.ico|images|chatbot.js|.*\\.(?:svg|png|jpg|jpeg|gif|webp|js|css|map)$).*)',
  ],
}
