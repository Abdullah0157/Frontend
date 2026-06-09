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

const parseDate = (dateStr) => {
  if (!dateStr) return 999
  const lower = dateStr.toLowerCase()
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
        const res = await fetch('/api/jobs/public-listing', { cache: 'no-store' })
        if (!res.ok) return
        const data = await res.json()
        if (cancelled || !Array.isArray(data.jobs)) return
        setAllJobs(data.jobs)
        setJobs(data.jobs)
        setRankedByResume(!!data.ranked)
      } catch {}
    }
    loadUnified()
    return () => { cancelled = true }
  }, [])

  const filterTypes = ['All', 'AI Interview', 'External Apply']

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
      const response = await axios.post(`${process.env.NEXT_PUBLIC_API_URL}/match-resume`, formData, {
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
    const filtered = allJobs.filter(job => {
      const matchesQuery = job.title.toLowerCase().includes(query.toLowerCase()) || 
                          job.company.toLowerCase().includes(query.toLowerCase()) ||
                          job.tags.some(tag => tag.toLowerCase().includes(query.toLowerCase()))
      return matchesQuery
    })
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
    <div className="bg-transparent min-h-screen pb-20">
      {/* Header Section - Image Background & Transparent */}
      <section className="relative pt-24 pb-32 overflow-hidden border-b border-white/10">
        {/* Background Image with Opacity */}
        <div 
          className="absolute inset-0 z-0 opacity-40 bg-cover bg-center"
          style={{ backgroundImage: "url('/images/banner.jpeg')" }}
        ></div>
        {/* Blue/Indigo Overlay to blend with theme */}
        <div className="absolute inset-0 z-1 bg-gradient-to-r from-blue-600/30 via-indigo-600/30 to-purple-600/30"></div>
        
        <div className="container mx-auto px-4 relative z-10 text-center">
          <h1 className="text-3xl md:text-5xl font-black mb-6 tracking-tight uppercase text-white shadow-sm">Discover Your Future</h1>
        </div>
      </section>

      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row items-stretch gap-4 max-w-5xl mx-auto -mt-10 relative z-10 md:h-[88px]">
          
          {/* SearchBar */}
          <div className="flex-grow w-full">
            <SearchBar onSearch={handleSearch} />
          </div>
        </div>

        <div className="mt-16 flex flex-col">
            {/* Filter tabs */}
            <div className="mb-6 flex flex-wrap gap-2 justify-center">
              {filterTypes.map((label) => {
                const active = activeFilter === label
                const count =
                  label === 'All' ? allJobs.length
                  : label === 'AI Interview' ? allJobs.filter((j) => j.type === 'ai_interview').length
                  : allJobs.filter((j) => j.type === 'external').length
                return (
                  <button
                    key={label}
                    onClick={() => handleFilter(label)}
                    className={`text-xs font-black uppercase tracking-widest px-5 py-3 rounded-full border transition flex items-center gap-2 ${
                      active
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-lg shadow-indigo-500/30'
                        : 'bg-slate-900 text-slate-300 border-slate-800 hover:border-indigo-700 hover:text-white'
                    }`}
                  >
                    {label === 'AI Interview' && <span>✦</span>}
                    {label}
                    <span className={`text-[10px] px-2 py-0.5 rounded-full ${active ? 'bg-white/20' : 'bg-slate-800'}`}>{count}</span>
                  </button>
                )
              })}
            </div>

            {rankedByResume && (
              <div className="mb-8 p-5 rounded-2xl bg-gradient-to-r from-indigo-950/60 to-blue-950/60 border border-indigo-800 flex items-center justify-between gap-4">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.4em] text-indigo-300 mb-1">Personalized for you</p>
                  <p className="text-white text-sm">
                    These jobs are ranked by how well they match your resume. Top matches first.
                  </p>
                </div>
                <a href="/profile" className="text-xs font-black uppercase tracking-widest px-4 py-2 rounded-full bg-white/10 hover:bg-white/20 text-white border border-white/20 whitespace-nowrap">
                  Update Resume
                </a>
              </div>
            )}
            {isMatching ? (
              <LoadingState message="Analyzing Resume" />
            ) : jobs.length > 0 ? (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
                  {currentJobs.map(job => (
                    <JobCard key={job.id} job={job} />
                  ))}
                </div>

                {/* Pagination Controls */}
                {totalPages > 1 && (
                  <div className="mt-20 flex justify-center items-center gap-4">
                    <button 
                      onClick={() => paginate(Math.max(1, currentPage - 1))}
                      disabled={currentPage === 1}
                      className="w-14 h-14 rounded-2xl bg-slate-900 shadow-lg border border-slate-800 text-indigo-400 font-bold flex items-center justify-center hover:bg-indigo-950/40 hover:border-indigo-900 disabled:opacity-30 disabled:cursor-not-allowed transition-all transform active:scale-95"
                    >
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M15 19l-7-7 7-7" />
                      </svg>
                    </button>
                    
                    <div className="flex items-center gap-2">
                      {Array.from({ length: totalPages }, (_, i) => {
                        const page = i + 1;
                        // Show limited pagination numbers
                        if (totalPages > 7) {
                          if (page !== 1 && page !== totalPages && Math.abs(page - currentPage) > 1) {
                            if (page === 2 || page === totalPages - 1) {
                               return <span key={i} className="px-2 text-slate-300 font-black tracking-widest">...</span>
                            }
                            return null;
                          }
                        }
                        
                        return (
                          <button
                            key={page}
                            onClick={() => paginate(page)}
                            className={`w-14 h-14 rounded-2xl font-black text-sm flex items-center justify-center transition-all shadow-md border ${
                              currentPage === page 
                                ? 'bg-indigo-600 border-indigo-600 text-white shadow-indigo-500/40 ring-4 ring-indigo-500/10' 
                                : 'bg-slate-900 border-slate-800 text-slate-400 hover:bg-slate-900 hover:border-indigo-200 hover:text-indigo-400'
                            }`}
                          >
                            {page}
                          </button>
                        )
                      })}
                    </div>

                    <button 
                      onClick={() => paginate(Math.min(totalPages, currentPage + 1))}
                      disabled={currentPage === totalPages}
                      className="w-14 h-14 rounded-2xl bg-slate-900 shadow-lg border border-slate-800 text-indigo-400 font-bold flex items-center justify-center hover:bg-indigo-950/40 hover:border-indigo-900 disabled:opacity-30 disabled:cursor-not-allowed transition-all transform active:scale-95"
                    >
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                  </div>
                )}
              </>
            ) : (
              <div className="bg-slate-900/20 rounded-[3rem] p-20 text-center border border-dashed border-white/30 shadow-sm">
                <h3 className="text-2xl font-black text-white mb-3 uppercase">Nothing Found</h3>
              </div>
            )}
          </div>
        </div>
      </div>
  )
}
