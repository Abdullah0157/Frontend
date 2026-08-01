function Sk({ className }) {
  return <div className={`animate-pulse rounded bg-gray-100 ${className}`} />
}

export default function JobsLoading() {
  return (
    <div className="max-w-3xl">
      <div className="mb-8 space-y-1.5">
        <Sk className="h-6 w-36" />
        <Sk className="h-4 w-28" />
      </div>
      <div className="border border-gray-200 rounded-lg divide-y divide-gray-100">
        {[...Array(7)].map((_, i) => (
          <div key={i} className="flex items-start justify-between px-4 py-4">
            <div className="space-y-2 flex-1">
              <div className="flex gap-2">
                <Sk className="h-4 w-40" />
                <Sk className="h-4 w-20 rounded" />
              </div>
              <Sk className="h-3 w-72" />
            </div>
            <Sk className="h-8 w-16 rounded-md" />
          </div>
        ))}
      </div>
    </div>
  )
}
