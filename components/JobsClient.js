'use client'

import { useState, useEffect } from 'react'
import axios from 'axios'
import JobCard from '@/components/JobCard'
import SearchBar from '@/components/SearchBar'
import LoadingState from '@/components/LoadingState'

const parseSalary = (sal) => {
  if (!sal) return 0
  const numbers = sal.match(/\d+/g)
  if (!numbers) return 0
  let val = parseInt(numbers[0].replace(/,/g, ''))
  if (sal.toLowerCase().includes('hour')) val *= 2000
  return val
}

// Returns "days ago" for sorting. Handles BOTH a real timestamp (Date object or
// ISO string, which is what company-created jobs now use) AND the legacy
// relative strings ("2 days ago"). Never assumes a string — a non-string input
// used to crash this with `.toLowerCase is not a function`.
const parseDate = (dateStr) => {
  if (!dateStr) return 999
  // Real, parseable date → compute days since now.
  const d = dateStr instanceof Date ? dateStr : new Date(dateStr)
  if (!isNaN(d.getTime())) {
    const days = Math.floor((Date.now() - d.getTime()) / 86400000)
    return days >= 0 ? days : 0
  }
  // Legacy relative string.
  const lower = String(dateStr).toLowerCase()
  if (lower.includes('yesterday')) return 1
  if (lower.includes('today')) return 0
  const match = lower.match(/(\d+)/)
  let num = match ? parseInt(match[1]) : 0
  if (num === 0 && (lower.includes(' a ') || lower.startsWith('a '))) num = 1
  if (lower.includes('month')) return num * 30
  if (lower.includes('year')) return num * 365
  return num
}

export default function JobsClient({ initialJobs }) {
  const [allJobs, setAllJobs] = useState(initialJobs || [])
  const [jobs, setJobs] = useState(initialJobs || []) // filtered/searched base
  const [displayedJobs, setDisplayedJobs] = useState([]) // sorted final
  const [isMatching, setIsMatching] = useState(false)
  // If SSR already gave us jobs, render them immediately — no spinner needed.
  // The background fetch will silently swap in the full list when it lands.
  const [loading, setLoading] = useState(!initialJobs || initialJobs.length === 0)
  const [activeFilter, setActiveFilter] = useState('All')
  const [sortOption, setSortOption] = useState('Newest')
  const [rankedByResume, setRankedByResume] = useState(false)

  const [currentPage, setCurrentPage] = useState(1)
  const jobsPerPage = 12

  useEffect(() => {
    if (!initialJobs || initialJobs.length === 0) return

    const sortedData = [...initialJobs].sort((a, b) => parseDate(a.posted_at) - parseDate(b.posted_at))
    setAllJobs(sortedData)

    // Check for matches from the landing page
    const savedMatches = sessionStorage.getItem('matchedJobs')
    if (savedMatches && savedMatches !== 'null') {
      const matchedData = JSON.parse(savedMatches)
      if (Array.isArray(matchedData) && matchedData.length > 0) {
        setJobs(matchedData)
        setActiveFilter('AI Match')
        setTimeout(() => sessionStorage.removeItem('matchedJobs'), 2000)
      } else {
        setJobs(sortedData)
      }
    } else {
      setJobs(sortedData)
    }
  }, [initialJobs])

  // Fetch the unified listing (aggregated external + company-posted AI interview jobs).
  // When the user is a logged-in candidate with a resume, the endpoint also ranks by resume overlap.
  useEffect(() => {
    let cancelled = false
    async function loadUnified() {
      try {
        const res = await fetch('/api/jobs/public-listing', {
          next: { revalidate: 30 },
        })
        if (!res.ok) return
        const data = await res.json()
        if (cancelled || !Array.isArray(data.jobs)) return
        setAllJobs(data.jobs)
        setJobs(data.jobs)
        setRankedByResume(!!data.ranked)
      } catch {}
      finally { if (!cancelled) setLoading(false) }
    }
    loadUnified()
    return () => { cancelled = true }

  }, [])

  // External scraped jobs retired — every job is now a company AI-interview
  // role, so the sub-filters are redundant. Keep a single "All" tab.
  const filterTypes = ['All']

  const handleFilter = (type) => {
    setActiveFilter(type)
    if (type === 'All') {
      setJobs(allJobs)
    } else if (type === 'AI Interview') {
      setJobs(allJobs.filter((j) => j.type === 'ai_interview'))
    } else if (type === 'External Apply') {
      setJobs(allJobs.filter((j) => j.type === 'external'))
    }
    setCurrentPage(1)
  }

  const handleResumeUpload = async (event) => {
    const file = event.target.files[0]
    if (!file) return

    if (file.type !== 'application/pdf') {
      alert("Please upload a PDF file.")
      return
    }

    setIsMatching(true)
    const formData = new FormData()
    formData.append('file', file)

    try {
      const response = await axios.post('/api/match-resume', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })
      setJobs(response.data)
      setActiveFilter('AI Match')
      setSortOption('Default')
      setCurrentPage(1)
    } catch (error) {
      console.error("Error matching resume:", error)
      alert("Failed to process resume.")
    } finally {
      setIsMatching(false)
    }
  }

  const handleSearch = ({ query }) => {
    const q = query.trim().toLowerCase()
    const filtered = allJobs.filter((job) => !q || [job.title, job.company, job.role, job.description, ...(job.tags || [])]
      .some((field) => String(field || '').toLowerCase().includes(q)))
    setJobs(filtered)
    setCurrentPage(1)
  }

  const handleSort = (option) => {
    setSortOption(option)
    let sorted = [...jobs]

    if (option === 'Highest Paid') {
      sorted.sort((a, b) => parseSalary(b.salary) - parseSalary(a.salary))
    } else if (option === 'Lowest Paid') {
      sorted.sort((a, b) => parseSalary(a.salary) - parseSalary(b.salary))
    } else if (option === 'Newest') {
      sorted.sort((a, b) => parseDate(a.posted_at) - parseDate(b.posted_at))
    } else if (option === 'Oldest') {
      sorted.sort((a, b) => parseDate(b.posted_at) - parseDate(a.posted_at))
    }

    setJobs(sorted)
    setCurrentPage(1)
  }

  // Pagination logic
  const indexOfLastJob = currentPage * jobsPerPage
  const indexOfFirstJob = indexOfLastJob - jobsPerPage
  const currentJobs = jobs.slice(indexOfFirstJob, indexOfLastJob)
  const totalPages = Math.ceil(jobs.length / jobsPerPage)

  const paginate = (pageNumber) => {
    setCurrentPage(pageNumber)
    window.scrollTo({ top: 400, behavior: 'smooth' })
  }

  return (
    <div className="min-h-screen bg-white pb-20 pt-16 text-ink">
      <div className="border-b border-line bg-surface">
        <div className="mx-auto max-w-[1200px] px-6 py-12">
          <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 className="text-[32px] font-bold tracking-[-0.02em] md:text-[40px]">Find jobs</h1>
              <p className="mt-1 text-body">Apply by taking a short skills test and an AI interview. It is free.</p>
            </div>
            <span className="text-sm text-muted">{allJobs.length} open role{allJobs.length !== 1 ? 's' : ''}</span>
          </div>
          <div className="max-w-2xl">
            <SearchBar onSearch={handleSearch} />
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-[1200px] px-6 pt-10">
        {rankedByResume && (
          <div className="mb-8 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-[#C7CBF5] bg-brand-soft p-5">
            <div>
              <p className="mb-1 text-sm font-semibold text-brand-dark">Personalised for you</p>
              <p className="text-sm text-body">These jobs are ranked by how well they match your resume, best first.</p>
            </div>
            <a href="/profile" className="whitespace-nowrap rounded-[10px] bg-brand px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-dark">Update resume</a>
          </div>
        )}
        {isMatching ? (
          <LoadingState message="Reading your resume" />
        ) : loading ? (
          <div className="flex flex-col items-center justify-center gap-4 py-32" role="status">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-brand border-t-transparent" />
            <p className="text-sm text-muted">Loading jobs…</p>
          </div>
        ) : jobs.length > 0 ? (
          <>
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
              {currentJobs.map((job) => (
                <JobCard key={job.id} job={job} />
              ))}
            </div>

            {totalPages > 1 && (
              <nav aria-label="Pages" className="mt-14 flex items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={() => paginate(Math.max(1, currentPage - 1))}
                  disabled={currentPage === 1}
                  aria-label="Previous page"
                  className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-line bg-white text-ink hover:bg-surface disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                </button>
                {Array.from({ length: totalPages }, (_, i) => {
                  const page = i + 1
                  if (totalPages > 7 && page !== 1 && page !== totalPages && Math.abs(page - currentPage) > 1) {
                    return page === 2 || page === totalPages - 1 ? <span key={page} className="px-1 text-muted">…</span> : null
                  }
                  return (
                    <button
                      key={page}
                      type="button"
                      onClick={() => paginate(page)}
                      aria-current={currentPage === page ? 'page' : undefined}
                      className={`inline-flex h-11 min-w-[44px] items-center justify-center rounded-xl border px-3 text-sm font-semibold ${
                        currentPage === page ? 'border-brand bg-brand text-white' : 'border-line bg-white text-body hover:bg-surface'
                      }`}
                    >
                      {page}
                    </button>
                  )
                })}
                <button
                  type="button"
                  onClick={() => paginate(Math.min(totalPages, currentPage + 1))}
                  disabled={currentPage === totalPages}
                  aria-label="Next page"
                  className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-line bg-white text-ink hover:bg-surface disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                </button>
              </nav>
            )}
          </>
        ) : (
          <div className="rounded-2xl border border-dashed border-[#CDD2DA] bg-surface px-6 py-16 text-center">
            <h2 className="mb-2 text-xl font-semibold">No jobs match that search</h2>
            <p className="text-body">Try a different word, or clear the search to see every open role.</p>
          </div>
        )}
      </div>
    </div>
  )
}
