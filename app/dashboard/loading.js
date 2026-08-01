function Sk({ className }) {
  return <div className={`animate-pulse rounded bg-gray-100 ${className}`} />
}

export default function DashboardLoading() {
  return (
    <div className="max-w-3xl">
      <div className="mb-8 space-y-1.5">
        <Sk className="h-6 w-32" />
        <Sk className="h-4 w-44" />
      </div>
      <div className="grid grid-cols-3 gap-4 mb-8">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="border border-gray-200 rounded-lg px-4 py-4 space-y-2">
            <Sk className="h-3 w-20" />
            <Sk className="h-5 w-12" />
          </div>
        ))}
      </div>
      <Sk className="h-4 w-36 mb-3" />
      <div className="border border-gray-200 rounded-lg divide-y divide-gray-100">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="flex items-center justify-between px-4 py-3">
            <div className="space-y-1.5">
              <Sk className="h-4 w-48" />
              <Sk className="h-3 w-28" />
            </div>
            <Sk className="h-4 w-16" />
          </div>
        ))}
      </div>
    </div>
  )
}
