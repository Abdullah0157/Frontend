// Instantly shown skeleton while the actual page compiles/fetches.
// In dev this hides route-compilation latency; in prod it covers the RSC roundtrip.

export default function AdminLoading() {
  return (
    <div className="space-y-8 animate-pulse">
      {/* Title row */}
      <div>
        <div className="h-8 w-64 bg-slate-200 rounded" />
        <div className="h-4 w-96 bg-slate-100 rounded mt-2" />
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-32 bg-white border border-slate-200 rounded-2xl p-5 flex flex-col justify-between">
            <div className="flex items-start justify-between">
              <div className="h-3 w-16 bg-slate-200 rounded" />
              <div className="w-2 h-2 rounded-full bg-slate-200" />
            </div>
            <div>
              <div className="h-8 w-12 bg-slate-200 rounded" />
              <div className="h-3 w-20 bg-slate-100 rounded mt-2" />
            </div>
          </div>
        ))}
      </div>

      {/* Chart placeholders */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="bg-white border border-slate-200 rounded-2xl p-6 h-72">
            <div className="h-4 w-32 bg-slate-200 rounded" />
            <div className="h-3 w-48 bg-slate-100 rounded mt-2 mb-6" />
            <div className="h-48 bg-slate-100 rounded" />
          </div>
        ))}
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl p-6 h-64">
        <div className="h-4 w-40 bg-slate-200 rounded" />
        <div className="h-48 bg-slate-100 rounded mt-6" />
      </div>
    </div>
  )
}
