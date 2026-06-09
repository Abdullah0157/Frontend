import CompanySidebar from '@/components/CompanySidebar'

export const metadata = { title: 'Company Dashboard — JobStream' }

export default function CompanyLayout({ children }) {
  return (
    <div className="min-h-screen bg-slate-950">
      <CompanySidebar />
      <main className="ml-64 min-h-screen">{children}</main>
    </div>
  )
}
