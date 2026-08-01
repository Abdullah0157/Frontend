// ⚠️ DEV-ONLY test route — mounts AssessmentExperience without auth so the
// adaptive assessment flow can be exercised without a Supabase login.
// Middleware protects only /jobs, /profile, /company, /interview, /admin,
// /dashboard — so /dev/* (and /assessment itself) is public.
//
// Preloaded with the Senior Backend Engineer (L4) role so every test run
// starts from the same assessment shape.
//
// DELETE THIS FILE BEFORE PRODUCTION DEPLOY.
// Search for "dev/assessment-test" to find any references.

import AssessmentExperience from '@/app/dashboard/assessment/AssessmentExperience'

export const metadata = { title: 'Assessment Test — JobStream (Dev)' }

export default function AssessmentTestPage() {
  return (
    <div>
      <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] px-4 py-1.5 rounded-full bg-amber-500 text-white text-xs font-black uppercase tracking-widest shadow-lg">
        DEV — Assessment Test
      </div>
      <AssessmentExperience roleFamily="swe-backend" seniorityBand="L4" devMode />
    </div>
  )
}
