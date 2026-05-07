'use client'

import { useState, useEffect } from 'react'
import axios from 'axios'
import JobCard from '@/components/JobCard'
import SearchBar from '@/components/SearchBar'

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

export default function JobsPage() {
  const [allJobs, setAllJobs] = useState([])
  const [jobs, setJobs] = useState([]) // filtered/searched base
  const [displayedJobs, setDisplayedJobs] = useState([]) // sorted final
  const [loading, setLoading] = useState(true)
  const [isMatching, setIsMatching] = useState(false)
  const [activeFilter, setActiveFilter] = useState('All')
  const [sortOption, setSortOption] = useState('Newest')

  const [currentPage, setCurrentPage] = useState(1)
  const jobsPerPage = 12

  useEffect(() => {
    const fetchJobs = async () => {
      try {
        const response = await axios.get(`${process.env.NEXT_PUBLIC_API_URL}/jobs?limit=500`)
        const data = response.data
        data.sort((a, b) => parseDate(a.posted_at) - parseDate(b.posted_at))
        setAllJobs(data)
        setJobs(data)
      } catch (error) {
        console.error("Error fetching jobs:", error)
      } finally {
        setLoading(false)
      }
    }
    fetchJobs()
  }, [])

  const filterTypes = ['All', 'Full-time', 'Contract', 'Remote', 'Language']

  const handleFilter = (type) => {
    setActiveFilter(type)
    if (type === 'All') {
      setJobs(allJobs)
    } else if (type === 'Remote') {
      setJobs(allJobs.filter(job => job.location.toLowerCase().includes('remote')))
    } else if (type === 'Language') {
      setJobs(allJobs.filter(job => 
        job.title.toLowerCase().includes('language') || 
        job.tags.some(t => t.toLowerCase().includes('language'))
      ))
    } else {
      setJobs(allJobs.filter(job => job.type === type))
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
          
          {/* AI Resume Match Card (Horizontal version) */}
          <div className="w-full md:w-auto bg-slate-900 rounded-2xl shadow-xl border border-indigo-500/40 px-6 py-4 transition-all hover:shadow-2xl hover:shadow-indigo-500/20 relative overflow-hidden flex items-center shrink-0">
            <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/20 to-purple-600/20 z-0"></div>
            <div className="relative z-10 flex items-center justify-between w-full gap-4">
              <div className="flex flex-col justify-center">
                <span className="font-black text-white text-sm uppercase tracking-widest drop-shadow-md flex items-center">
                  <svg className="w-4 h-4 mr-1 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  AI Match
                </span>
                <span className="text-[9px] text-indigo-200/60 uppercase font-bold tracking-widest mt-1">
                  Find perfect jobs
                </span>
              </div>
              
              <label className="cursor-pointer flex items-center justify-center py-3 px-5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-lg shadow-indigo-500/30 whitespace-nowrap">
                {isMatching ? 'Wait...' : 'Upload PDF'}
                <input type="file" className="hidden" accept=".pdf" onChange={handleResumeUpload} disabled={isMatching} />
              </label>
            </div>
          </div>

          {/* SearchBar */}
          <div className="flex-grow w-full">
            <SearchBar onSearch={handleSearch} />
          </div>
        </div>

        <div className="mt-16 flex flex-col">
            {loading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
                {[1, 2, 3, 4, 5, 6].map(i => (
                  <div key={i} className="h-80 bg-white/10 animate-pulse rounded-[3rem] border border-white/20 shadow-sm"></div>
                ))}
              </div>
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
                      className="w-14 h-14 rounded-2xl bg-white shadow-lg border border-slate-100 text-indigo-600 font-bold flex items-center justify-center hover:bg-indigo-50 hover:border-indigo-100 disabled:opacity-30 disabled:cursor-not-allowed transition-all transform active:scale-95"
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
                                : 'bg-white border-slate-100 text-slate-500 hover:bg-white hover:border-indigo-200 hover:text-indigo-600'
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
                      className="w-14 h-14 rounded-2xl bg-white shadow-lg border border-slate-100 text-indigo-600 font-bold flex items-center justify-center hover:bg-indigo-50 hover:border-indigo-100 disabled:opacity-30 disabled:cursor-not-allowed transition-all transform active:scale-95"
                    >
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                  </div>
                )}
              </>
            ) : (
              <div className="bg-white/20 rounded-[3rem] p-20 text-center border border-dashed border-white/30 shadow-sm">
                <h3 className="text-2xl font-black text-slate-900 mb-3 uppercase">Nothing Found</h3>
              </div>
            )}
          </div>
        </div>
      </div>
  )
}
