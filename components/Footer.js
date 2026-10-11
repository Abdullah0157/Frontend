'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const LINKEDIN = 'https://www.linkedin.com/company/jobstream-opportunity'

// Site footer (design option A).
export default function Footer() {
  const pathname = usePathname() || ''

  // Hide the footer inside the logged-in app areas (dashboards) and the
  // immersive interview/assessment screens — same rule as the header.
  const hideFooter =
    /^\/(dashboard|company|admin)(\/|$)/.test(pathname) ||
    /^\/jobs\/.+\/interview$|^\/interview\/[^/]+\/session/.test(pathname) ||
    /^\/assessment(\/|$)/.test(pathname) ||
    /^\/dev\//.test(pathname)

  if (hideFooter) return null

  const columns = [
    { title: 'Product', links: [
      { href: '/#companies', label: 'For companies' },
      { href: '/#candidates', label: 'For candidates' },
      { href: '/jobs', label: 'Find jobs' },
      { href: '/signup/company', label: 'Post a job' },
    ] },
    { title: 'Company', links: [
      { href: '/about', label: 'About' },
      { href: '/blog', label: 'Blog' },
      { href: LINKEDIN, label: 'Contact', external: true },
    ] },
    { title: 'Legal', links: [
      { href: '/privacy', label: 'Privacy' },
    ] },
  ]

  return (
    <footer className="relative z-10 border-t border-line bg-white">
      <div className="mx-auto flex max-w-[1200px] flex-wrap gap-x-16 gap-y-10 px-6 py-14">
        <div className="min-w-[220px] flex-1">
          <Link href="/" className="flex items-center gap-2.5 text-ink">
            <img src="/jobstream-icon.png" alt="" className="h-8 w-8 object-contain" />
            <span className="text-[19px] font-bold tracking-tight">JobStream</span>
          </Link>
          <p className="mt-3 max-w-xs text-sm text-muted">Skills tests and AI interviews, so hiring decisions rest on evidence.</p>
        </div>
        {columns.map((col) => (
          <nav key={col.title} aria-label={col.title} className="min-w-[140px]">
            <h2 className="mb-3 text-sm font-semibold text-ink">{col.title}</h2>
            <ul className="space-y-2.5">
              {col.links.map((l) => (
                <li key={l.label}>
                  {l.external ? (
                    <a href={l.href} target="_blank" rel="noopener noreferrer" className="text-sm text-body hover:text-ink">{l.label}</a>
                  ) : (
                    <Link href={l.href} className="text-sm text-body hover:text-ink">{l.label}</Link>
                  )}
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>
      <div className="border-t border-line">
        <div className="mx-auto flex max-w-[1200px] flex-wrap items-center justify-between gap-4 px-6 py-6 text-sm text-muted">
          <span>© {new Date().getFullYear()} JobStream</span>
          <a href={LINKEDIN} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-body hover:text-ink">
            <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.761 0 5-2.239 5-5v-14c0-2.761-2.239-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z" /></svg>
            LinkedIn
          </a>
        </div>
      </div>
    </footer>
  )
}
