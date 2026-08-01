import Link from 'next/link'

// Clean, minimal job card (Mercor-style): title, subtitle line, and a bottom
// meta row. Whole card is a link into the application hub.
export default function JobCard({ job }) {
  const { id, slug, title, company, role, salary, type: jobType, link, match_pct } = job

  const isAi = jobType === 'ai_interview'
  const detailHref = link || (isAi ? `/interview/${slug}` : `/jobs/${id}`)

  return (
    <Link
      href={detailHref}
      className="group flex flex-col h-full min-h-[190px] bg-white border border-slate-200 rounded-2xl p-6 hover:border-indigo-400 hover:shadow-[0_10px_30px_-12px_rgba(79,70,229,0.25)] transition-all"
    >
      {/* Title */}
      <h3 className="text-lg font-bold text-slate-900 leading-snug group-hover:text-indigo-600 transition-colors line-clamp-2">
        {title}
      </h3>

      {/* Subtitle line: role (falls back to company) */}
      <p className="text-sm text-slate-500 mt-2">
        {role || company}{role && company ? ` · ${company}` : ''}
      </p>

      {typeof match_pct === 'number' && match_pct >= 15 && (
        <span className={`inline-flex w-fit mt-3 text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full border ${
          match_pct >= 70 ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
          : match_pct >= 40 ? 'text-indigo-700 bg-indigo-50 border-indigo-200'
          : 'text-amber-700 bg-amber-50 border-amber-200'
        }`}>
          {match_pct}% match
        </span>
      )}

      {/* Bottom meta row */}
      <div className="mt-auto pt-5 flex items-center justify-between">
        <span className="inline-flex items-center gap-1.5 text-[11px] font-black uppercase tracking-widest text-indigo-600">
          <span className="text-indigo-500">✦</span> AI Interview
        </span>
        <span className="inline-flex items-center gap-1.5 text-slate-400 text-sm">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 5l7 7m0 0l-7 7m7-7H3" />
          </svg>
        </span>
      </div>
    </Link>
  )
}
