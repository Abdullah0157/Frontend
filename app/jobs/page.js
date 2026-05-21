import JobsClient from '@/components/JobsClient'

export const metadata = {
  title: 'Find Jobs | JobStream AI',
  description: 'Browse the latest remote and full-time tech jobs matched by AI.',
}

async function getJobs() {
  // Use absolute URL since this runs on the server
  // Fallback to localhost if NEXT_PUBLIC_API_URL is not set or relative
  let apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api'
  
  if (apiUrl.startsWith('/')) {
    apiUrl = `http://localhost:8000${apiUrl}`
  }

  try {
    const res = await fetch(`${apiUrl}/jobs?limit=500`, { 
      // Next.js App Router ISR setting: cache the page and revalidate in background every 60 seconds.
      // This allows <Link> components on other pages to prefetch the fully rendered payload instantly.
      next: { revalidate: 60 }
    })
    
    if (!res.ok) {
      console.error('Failed to fetch jobs:', res.statusText)
      return []
    }
    
    return res.json()
  } catch (error) {
    console.error('Error fetching jobs server-side:', error)
    return []
  }
}

export default async function JobsPage() {
  const jobs = await getJobs()
  
  return (
    <JobsClient initialJobs={jobs} />
  )
}
