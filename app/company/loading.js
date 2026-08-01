// Instant skeleton while a company dashboard route compiles/fetches, so
// sidebar navigation feels immediate instead of blank-then-jump.
function Sk({ className }) {
  return <div className={`animate-pulse rounded bg-slate-100 ${className}`} />
}

export default function CompanyLoading() {
  return (
    <div className="px-4 sm:px-6 md:px-8 py-8">
      <div className="mb-8 space-y-2">
        <Sk className="h-3 w-20" />
        <Sk className="h-9 w-64" />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {Array.from({ length: 4 }).map((_, i) => (
          <Sk key={i} className="h-28 rounded-2xl" />
        ))}
      </div>
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Sk key={i} className="h-20 rounded-2xl" />
        ))}
      </div>
    </div>
  )
}
