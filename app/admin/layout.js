import { requireRole, ROLES } from '@/lib/roles'
import AdminSidebar from './AdminSidebar'

export const metadata = { title: 'Super Admin — JobStream' }

export default async function AdminLayout({ children }) {
  const { user } = await requireRole(ROLES.SUPER_ADMIN)

  return (
    <div className="min-h-screen bg-white">
      <AdminSidebar email={user.email} />
      <main className="md:ml-24 min-h-screen px-4 sm:px-6 md:px-10 lg:px-14 pt-20 md:pt-10 pb-10 bg-white">
        {children}
      </main>
    </div>
  )
}
