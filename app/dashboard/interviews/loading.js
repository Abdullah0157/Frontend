function Sk({ className }) {
  return <div className={`animate-pulse rounded-lg bg-slate-200 ${className}`} />
}

export default function InterviewsLoading() {
  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex items-center justify-between gap-4 mb-8">
        <Sk className="h-9 w-56" />
        <Sk className="h-4 w-20" />
      </div>
      <div className="space-y-4">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="bg-white border border-slate-200 rounded-2xl p-6 flex items-center justify-between gap-4">
            <div className="space-y-2 min-w-0 flex-1">
              <Sk className="h-5 w-56" />
              <Sk className="h-3.5 w-40" />
            </div>
            <div className="flex items-center gap-3 flex-shrink-0">
              <Sk className="h-4 w-10" />
              <Sk className="h-5 w-20 rounded-full" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
