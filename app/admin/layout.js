import { requireRole, ROLES } from '@/lib/roles'
import AdminSidebar from './AdminSidebar'
import WorkspaceTopbar from '@/components/WorkspaceTopbar'

export const metadata = { title: 'Super Admin — JobStream' }

export default async function AdminLayout({ children }) {
  const { user } = await requireRole(ROLES.SUPER_ADMIN)

  return (
    <div className="min-h-screen bg-white">
      <AdminSidebar email={user.email} />
      <div className="md:ml-24 min-h-screen bg-white">
        <WorkspaceTopbar profileHref="/admin" email={user.email} roleLabel="Super Admin" homeHref="/admin" />
        <main className="px-4 sm:px-6 md:px-10 lg:px-14 pt-8 pb-10">
          {children}
        </main>
      </div>
    </div>
  )
}
