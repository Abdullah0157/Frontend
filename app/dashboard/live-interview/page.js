export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import { getSupabaseServer } from '@/lib/supabase/server'
import LiveVoiceExperience from '@/components/LiveVoiceExperience'

export default async function LiveInterviewPage() {
  const supabase = getSupabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login?next=/dashboard/live-interview')

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl md:text-4xl font-black tracking-tight text-slate-900">Live Interview</h1>
        <p className="text-slate-500 mt-2 max-w-2xl">
          A real-time voice conversation with Maya, powered by Gemini Live — sub-2-second, full-duplex
          (you can interrupt). Beta pilot.
        </p>
      </div>
      <LiveVoiceExperience role="Senior Backend Engineer" />
    </div>
  )
}
