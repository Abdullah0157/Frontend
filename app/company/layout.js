import { requireRole, ROLES } from '@/lib/roles'
import CompanySidebar from '@/components/CompanySidebar'
import WorkspaceTopbar from '@/components/WorkspaceTopbar'

export const metadata = { title: 'Company Dashboard — JobStream' }

export default async function CompanyLayout({ children }) {
  // Only company-role users can access /company/*. Super admins are redirected
  // to /admin (they have their own workspace); candidates are redirected to
  // /dashboard. Not-logged-in → /login.
  const { user } = await requireRole(ROLES.COMPANY)

  return (
    <div className="min-h-screen bg-slate-50">
      <CompanySidebar />
      <div className="md:ml-64 min-h-screen">
        <WorkspaceTopbar profileHref="/company/settings" email={user.email} roleLabel="Company" homeHref="/company" />
        <main className="px-4 sm:px-6 md:px-8 pt-8 pb-10">{children}</main>
      </div>
    </div>
  )
}
