import Link from 'next/link'

export const metadata = { title: 'Page not found' }

// Shown for any address that does not exist, with the main ways back.
export default function NotFound() {
  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4 py-24">
      <div className="max-w-md text-center">
        <p className="text-sm font-semibold text-indigo-600 mb-3">404</p>
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-slate-900 mb-4">We could not find that page</h1>
        <p className="text-slate-600 mb-8">The link may be old, or the page may have moved. These might help:</p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link href="/jobs" className="px-6 py-3 rounded-xl bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800 transition">Find jobs</Link>
          <Link href="/" className="px-6 py-3 rounded-xl border border-slate-300 text-slate-800 text-sm font-semibold hover:bg-slate-50 transition">Go to the home page</Link>
        </div>
      </div>
    </div>
  )
}
