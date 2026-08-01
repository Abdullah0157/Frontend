import { requireRole, ROLES } from '@/lib/roles'
import DashboardSidebar from './DashboardSidebar'

export const metadata = { title: 'Dashboard — JobStream' }

export default async function DashboardLayout({ children }) {
  // Candidate workspace. Super admins → /admin, company users → /company,
  // not-logged-in → /login. Handled by requireRole.
  const { user } = await requireRole(ROLES.CANDIDATE)

  return (
    <div className="min-h-screen bg-white">
      <DashboardSidebar email={user.email} />
      <main className="md:ml-24 min-h-screen px-4 sm:px-6 md:px-10 lg:px-14 pt-20 md:pt-10 pb-10 bg-white">
        {children}
      </main>
    </div>
  )
}
