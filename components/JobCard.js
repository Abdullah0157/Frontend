import Link from 'next/link'
import axios from 'axios'

export default function JobCard({ job }) {
  const {
    id, slug, title, company, location, type, salary,
    tags, is_new, is_high_demand, apply_url, match_pct,
    type: jobType, link,
  } = job

  const isAi = jobType === 'ai_interview'
  // Detail link points to the right place per type.
  const detailHref = link || (isAi ? `/interview/${slug}` : `/jobs/${id}`)

  const handleApply = async () => {
    try {
      await axios.post(`${process.env.NEXT_PUBLIC_API_URL}/analytics/total_applies`, { increment_by: 1 })
    } catch (err) { console.error('Apply track failed', err) }
  }

  const matchTier =
    typeof match_pct !== 'number' ? null
    : match_pct >= 70 ? { label: `${match_pct}% match`, cls: 'text-emerald-300 bg-emerald-500/20 border-emerald-500/40' }
    : match_pct >= 40 ? { label: `${match_pct}% match`, cls: 'text-indigo-300 bg-indigo-500/20 border-indigo-500/40' }
    : match_pct >= 15 ? { label: `${match_pct}% match`, cls: 'text-amber-300 bg-amber-500/20 border-amber-500/40' }
    : null

  return (
    <div className="bg-gradient-to-br from-indigo-950/80 via-slate-950/90 to-black border border-white/5 rounded-[2rem] p-6 flex flex-col h-full hover:shadow-[0_40px_80px_-15px_rgba(79,70,229,0.4)] transition-all duration-500 hover:-translate-y-2 group relative z-10 backdrop-blur-xl">
      {/* Top Badges */}
      <div className="flex flex-wrap gap-2 mb-3">
        {isAi && (
          <span className="text-[10px] font-black uppercase tracking-widest text-white bg-gradient-to-r from-indigo-600 to-purple-600 px-3 py-1 rounded-full shadow-[0_0_20px_rgba(99,102,241,0.6)]">
            ✦ AI Interview
          </span>
        )}
        {matchTier && (
          <span className={`text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full border ${matchTier.cls}`}>
            {matchTier.label}
          </span>
        )}
        {is_new && !isAi && (
          <span className="text-[10px] font-black uppercase tracking-widest text-white bg-blue-600 px-3 py-1 rounded-full shadow-[0_0_20px_rgba(37,99,235,0.6)]">
            New
          </span>
        )}
        {is_high_demand && (
          <span className="text-[10px] font-black uppercase tracking-widest text-indigo-400 bg-slate-900/5 px-3 py-1 rounded-full border border-white/10">
            High Demand
          </span>
        )}
      </div>

      {/* Header */}
      <div className="mb-4">
        <h3 className="text-xl font-black text-white mb-2 group-hover:text-blue-400 transition-colors uppercase tracking-tight leading-tight">
          <Link href={detailHref}>{title}</Link>
        </h3>
        <p className="text-blue-300/40 font-bold text-xs flex items-center uppercase tracking-widest">
          {company}
        </p>
      </div>

      {/* Meta info */}
      <div className="space-y-2 mb-5">
        <div className="flex items-center text-white/40 text-[10px] font-black uppercase tracking-[0.2em]">
          <div className="w-6 h-6 rounded-md bg-slate-900/5 flex items-center justify-center mr-3 border border-white/5 group-hover:border-blue-500/30 transition-colors">
            <svg className="h-3 w-3 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
            </svg>
          </div>
          {location}
        </div>
        <div className="flex items-center text-white/40 text-[10px] font-black uppercase tracking-[0.2em]">
          <div className="w-6 h-6 rounded-md bg-slate-900/5 flex items-center justify-center mr-3 border border-white/5 group-hover:border-blue-500/30 transition-colors">
            <svg className="h-3 w-3 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          {salary}
        </div>
      </div>

      {/* Tags */}
      <div className="flex flex-wrap gap-2 mt-auto mb-5">
        {tags && tags.slice(0, 3).map(tag => (
          <span key={tag} className="text-[9px] font-black uppercase tracking-widest text-slate-400 bg-slate-800 px-2 py-1 rounded-md border border-slate-700 group-hover:border-slate-300 transition-colors">
            {tag}
          </span>
        ))}
      </div>

      {/* Footer */}
      <div className="flex items-center gap-3 pt-4 border-t border-white/5">
        {isAi ? (
          <Link
            href={detailHref}
            className="btn-style-9 w-full justify-center !py-4 !px-6 text-xs tracking-[0.4em]"
          >
            <div className="btn-shimmer"></div>
            <span>START AI INTERVIEW</span>
            <svg className="h-4 w-4 ml-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M14 5l7 7m0 0l-7 7m7-7H3" />
            </svg>
          </Link>
        ) : apply_url && apply_url !== "" ? (
          <Link
            href={apply_url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={handleApply}
            className="btn-style-9 w-full justify-center !py-4 !px-6 text-xs tracking-[0.4em]"
          >
            <div className="btn-shimmer"></div>
            <span>APPLY NOW</span>
            <svg className="h-4 w-4 ml-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M14 5l7 7m0 0l-7 7m7-7H3" />
            </svg>
          </Link>
        ) : (
          <button
            disabled
            className="w-full justify-center py-4 px-6 text-xs tracking-[0.4em] font-black uppercase text-white/30 bg-slate-900/5 rounded-xl border border-white/5 cursor-not-allowed"
          >
            <span>LINK PENDING</span>
          </button>
        )}
      </div>
    </div>
  )
}
