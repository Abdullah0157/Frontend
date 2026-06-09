'use client'

import { createBrowserClient } from '@supabase/ssr'

let cached = null

export function getSupabaseBrowser() {
  if (!cached) {
    cached = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
    )
  }
  return cached
}
