// Skill Profile rendered INSIDE the candidate dashboard (with the sidebar),
// instead of the standalone /skill-profile route that shows the public site
// chrome. Reuses the same client component with `embedded` to drop the
// marketing-header top padding.
import SkillProfilePage from '@/app/skill-profile/page'

export const metadata = { title: 'Skill Profile — JobStream' }

export default function DashboardSkillsPage() {
  return <SkillProfilePage embedded />
}
