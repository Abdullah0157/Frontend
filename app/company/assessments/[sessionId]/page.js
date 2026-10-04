'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import WrittenReportView from '@/components/WrittenReportView'

export default function CompanyWrittenReport() {
  const { sessionId } = useParams()
  const [data, setData] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch(`/api/company/written-reports/${sessionId}`, { cache: 'no-store' })
      .then(async (r) => { const d = await r.json(); if (!r.ok) throw new Error(d.error || 'Could not load the report'); return d })
      .then(setData)
      .catch((e) => setError(e.message))
  }, [sessionId])

  if (error) return <div className="px-8 py-10"><p className="text-red-600">{error}</p></div>
  if (!data) return <div className="px-8 py-10"><p className="text-slate-400">Loading report…</p></div>
  return <WrittenReportView data={data} />
}
