import { requireRole, ROLES } from '@/lib/roles'
import CompanySidebar from '@/components/CompanySidebar'

export const metadata = { title: 'Company Dashboard — JobStream' }

export default async function CompanyLayout({ children }) {
  // Only company-role users can access /company/*. Super admins are redirected
  // to /admin (they have their own workspace); candidates are redirected to
  // /dashboard. Not-logged-in → /login.
  await requireRole(ROLES.COMPANY)

  return (
    <div className="min-h-screen bg-slate-50">
      <CompanySidebar />
      <main className="md:ml-64 min-h-screen pt-16 md:pt-0">{children}</main>
    </div>
  )
}
