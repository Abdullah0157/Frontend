import Link from 'next/link'

export default function JobCard({ job }) {
  const { 
    id, title, company, location, type, salary, 
    tags, is_new, is_high_demand, apply_url 
  } = job

  return (
    <div className="bg-gradient-to-br from-indigo-950/80 via-slate-950/90 to-black border border-white/5 rounded-[2rem] p-6 flex flex-col h-full hover:shadow-[0_40px_80px_-15px_rgba(79,70,229,0.4)] transition-all duration-500 hover:-translate-y-2 group relative z-10 backdrop-blur-xl">
      {/* Top Badges */}
      <div className="flex flex-wrap gap-2 mb-3">
        {is_new && (
          <span className="text-[10px] font-black uppercase tracking-widest text-white bg-blue-600 px-3 py-1 rounded-full shadow-[0_0_20px_rgba(37,99,235,0.6)]">
            New
          </span>
        )}
        {is_high_demand && (
          <span className="text-[10px] font-black uppercase tracking-widest text-indigo-400 bg-white/5 px-3 py-1 rounded-full border border-white/10">
            High Demand
          </span>
        )}
      </div>

      {/* Header */}
      <div className="mb-4">
        <h3 className="text-xl font-black text-white mb-2 group-hover:text-blue-400 transition-colors uppercase tracking-tight leading-tight">
          <Link href={`/jobs/${id}`}>{title}</Link>
        </h3>
        <p className="text-blue-300/40 font-bold text-xs flex items-center uppercase tracking-widest">
          {company}
        </p>
      </div>

      {/* Meta info */}
      <div className="space-y-2 mb-5">
        <div className="flex items-center text-white/40 text-[10px] font-black uppercase tracking-[0.2em]">
          <div className="w-6 h-6 rounded-md bg-white/5 flex items-center justify-center mr-3 border border-white/5 group-hover:border-blue-500/30 transition-colors">
            <svg className="h-3 w-3 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
            </svg>
          </div>
          {location}
        </div>
        <div className="flex items-center text-white/40 text-[10px] font-black uppercase tracking-[0.2em]">
          <div className="w-6 h-6 rounded-md bg-white/5 flex items-center justify-center mr-3 border border-white/5 group-hover:border-blue-500/30 transition-colors">
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
          <span key={tag} className="text-[9px] font-black uppercase tracking-widest text-white/30 bg-black/40 px-2 py-1 rounded-md border border-white/5 group-hover:border-white/10 transition-colors">
            {tag}
          </span>
        ))}
      </div>

      {/* Footer */}
      <div className="flex items-center gap-3 pt-4 border-t border-white/5">
        {apply_url && apply_url !== "" ? (
          <Link 
            href={apply_url} 
            target="_blank" 
            rel="noopener noreferrer"
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
            className="w-full justify-center py-4 px-6 text-xs tracking-[0.4em] font-black uppercase text-white/30 bg-white/5 rounded-xl border border-white/5 cursor-not-allowed"
          >
            <span>LINK PENDING</span>
          </button>
        )}
      </div>
    </div>
  )
}
