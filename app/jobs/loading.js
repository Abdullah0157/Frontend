import LoadingState from '@/components/LoadingState'

export default function Loading() {
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-white">
      <LoadingState message="Fetching Global Opportunities" />
    </div>
  )
}
