import { requireRole, ROLES } from '@/lib/roles'
import DashboardSidebar from './DashboardSidebar'
import WorkspaceTopbar from '@/components/WorkspaceTopbar'

export const metadata = { title: 'Dashboard — JobStream' }

export default async function DashboardLayout({ children }) {
  // Candidate workspace. Super admins → /admin, company users → /company,
  // not-logged-in → /login. Handled by requireRole.
  const { user } = await requireRole(ROLES.CANDIDATE)

  return (
    <div className="min-h-screen bg-white">
      <DashboardSidebar email={user.email} />
      <div className="md:ml-24 min-h-screen bg-white">
        <WorkspaceTopbar email={user.email} roleLabel="Candidate" homeHref="/dashboard" />
        <main className="px-4 sm:px-6 md:px-10 lg:px-14 pt-8 pb-10">
          {children}
        </main>
      </div>
    </div>
  )
}
