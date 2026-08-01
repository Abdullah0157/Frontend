// ⚠️ DEV-ONLY test route — mounts InterviewExperience without auth so the
// voice pipeline can be exercised without a Supabase login. Middleware
// protects only /jobs, /profile, /company, /interview — so /dev/* is public.
//
// Preloaded with a Senior Backend Engineer scenario so every test run starts
// from the same interview shape. The candidate can edit name/topics on the
// intake form before starting.
//
// DELETE THIS FILE BEFORE PRODUCTION DEPLOY.
// Search for "dev/voice-test" to find any references.

import InterviewExperience from '@/components/InterviewExperience'

export const metadata = { title: 'Voice Pipeline Test — JobStream (Dev)' }

// The topics Iris will probe across the interview. Chosen to test all
// dimensions of a senior backend engineer: system design depth, production
// ownership, past failures, cross-functional collaboration, and leadership.
// Each line becomes a focus area in primedContext.focusAreas → surfaces as
// INTERVIEW PRIORITIES in Iris's director note every turn.
const DEFAULT_FOCUS_TOPICS = `System design experience — the largest / hardest system they've owned end-to-end, trade-offs made
Production incident debugging — a specific high-pressure incident, root cause analysis, blast radius
Technical decisions they later regretted — what they'd change with hindsight and why
Cross-functional collaboration — working with PM, design, or infra teams under conflict
Mentorship and code review — how they lift other engineers and set craft standards
Approach to on-call, reliability, and observability — real metrics they own`

export default function VoiceTestPage() {
  return (
    <div>
      <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] px-4 py-1.5 rounded-full bg-amber-500 text-white text-xs font-black uppercase tracking-widest shadow-lg">
        DEV — Voice Pipeline Test
      </div>
      <InterviewExperience
        lockedRole="Senior Backend Engineer"
        initialFocus={DEFAULT_FOCUS_TOPICS}
        initialTotalQuestions={6}
      />
    </div>
  )
}
