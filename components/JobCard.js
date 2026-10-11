import Link from 'next/link'

// "Posted today", "Posted 3 days ago". Days only, so the server render and
// the browser agree.
function postedLabel(postedAt) {
  const d = postedAt ? new Date(postedAt) : null
  if (!d || isNaN(d.getTime())) return null
  const days = Math.max(0, Math.floor((Date.now() - d.getTime()) / 86400000))
  if (days === 0) return 'Posted today'
  if (days === 1) return 'Posted yesterday'
  if (days < 30) return `Posted ${days} days ago`
  return `Posted ${Math.floor(days / 30)} month${days < 60 ? '' : 's'} ago`
}

// Job card (design option A): company, title, the facts a candidate scans for,
// and how to apply. The whole card links into the application page.
export default function JobCard({ job }) {
  const { id, slug, title, company, role, salary, location, logo, posted_at: postedAt, type: jobType, link, match_pct: matchPct } = job

  const isAi = jobType === 'ai_interview'
  const detailHref = link || (isAi ? `/interview/${slug}` : `/jobs/${id}`)
  const posted = postedLabel(postedAt)
  const pay = salary && !/^apply via/i.test(salary) ? salary : null
  const companyName = company || 'Direct hire'

  return (
    <Link
      href={detailHref}
      className="group flex h-full min-h-[200px] flex-col rounded-2xl border border-line bg-white p-6 transition hover:border-[#C7CBF5] hover:shadow-[0_12px_32px_-14px_rgba(67,56,202,0.35)]"
    >
      <div className="flex items-center gap-3">
        {logo ? (
          <img src={logo} alt="" className="h-9 w-9 rounded-lg border border-line object-contain" />
        ) : (
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-brand-soft text-sm font-semibold text-brand" aria-hidden="true">
            {companyName.charAt(0).toUpperCase()}
          </span>
        )}
        <span className="truncate text-sm text-muted">{companyName}</span>
        {typeof matchPct === 'number' && matchPct >= 15 && (
          <span className={`ml-auto shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${
            matchPct >= 70 ? 'bg-[#DDF5E7] text-[#0F5132]' : matchPct >= 40 ? 'bg-brand-soft text-brand-dark' : 'bg-[#FFF3D6] text-[#7A4E00]'
          }`}>
            {matchPct}% match
          </span>
        )}
      </div>

      <h2 className="mt-4 line-clamp-2 text-lg font-semibold leading-snug text-ink group-hover:text-brand">{title}</h2>
      {role && role !== title && <p className="mt-1 text-sm text-body">{role}</p>}

      <p className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-sm text-muted">
        <span>{location || 'Remote'}</span>
        {pay && <span>{pay}</span>}
        {posted && <span>{posted}</span>}
      </p>

      <div className="mt-auto flex items-center justify-between pt-5">
        <span className="rounded-full bg-brand-soft px-2.5 py-1 text-xs font-semibold text-brand-dark">Skills test + AI interview</span>
        <svg className="text-muted transition group-hover:translate-x-0.5 group-hover:text-brand" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M5 12h14M13 6l6 6-6 6" />
        </svg>
      </div>
    </Link>
  )
}
