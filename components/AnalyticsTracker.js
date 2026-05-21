'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'
import axios from 'axios'

export default function AnalyticsTracker() {
  const pathname = usePathname()
  const API_URL = process.env.NEXT_PUBLIC_API_URL

  useEffect(() => {
    // 1. Track New Visit
    const trackVisit = async () => {
      try {
        await axios.post(`${API_URL}/analytics/total_visits`, { increment_by: 1 })
      } catch (err) { console.error('Visit track failed', err) }
    }

    // Only track a 'visit' on initial load
    trackVisit()

    // 2. Track Heartbeat (Time on Site)
    const heartbeat = setInterval(async () => {
      try {
        await axios.post(`${API_URL}/analytics/total_time`, { increment_by: 10 })
      } catch (err) { console.error('Heartbeat failed', err) }
    }, 10000)

    return () => clearInterval(heartbeat)
  }, [API_URL])

  useEffect(() => {
    // 3. Track Page Views (when route changes)
    console.log(`[Analytics] Page View: ${pathname}`)
    // You can add custom logging for specific pages here
  }, [pathname])

  return null // This component doesn't render anything
}
