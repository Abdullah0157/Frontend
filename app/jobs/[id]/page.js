'use client'

import { useParams } from 'next/navigation'
import { useState, useEffect } from 'react'
import axios from 'axios'
import Link from 'next/link'

export default function JobDetailPage() {
  const params = useParams()
  const { id } = params
  const [job, setJob] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchJob = async () => {
      try {
        const response = await axios.get(`${process.env.NEXT_PUBLIC_API_URL}/jobs/${id}`)
        setJob(response.data)
      } catch (error) {
        console.error("Error fetching job details:", error)
      } finally {
        setLoading(false)
      }
    }
    if (id) fetchJob()
  }, [id])

  if (loading) {
    return (
      <div className="bg-gray-50 min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-600"></div>
      </div>
    )
  }

  if (!job) {
    return (
      <div className="bg-gray-50 min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Job not found</h2>
          <Link href="/jobs" className="text-indigo-600 font-bold hover:underline">Back to All Jobs</Link>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-gray-50 min-h-screen pb-20">
      {/* Header / Breadcrumb */}
      <div className="bg-white border-b border-gray-100 py-6">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <Link href="/jobs" className="text-gray-500 hover:text-indigo-600 text-sm flex items-center mb-4 transition-colors">
            <svg className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back to All Jobs
          </Link>
          
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="flex items-center space-x-6">
              <div className="w-16 h-16 md:w-20 md:h-20 rounded-2xl bg-gray-100 flex items-center justify-center overflow-hidden border border-gray-100">
                <img src={job.logo} alt={`${job.company} logo`} className="w-full h-full object-cover" />
              </div>
              <div>
                <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-1">{job.title}</h1>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-gray-500">
                  <span className="font-medium text-indigo-600">{job.company}</span>
                  <span className="flex items-center">
                    <svg className="h-4 w-4 mr-1 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    </svg>
                    {job.location}
                  </span>
                  <span className="flex items-center">
                    <svg className="h-4 w-4 mr-1 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    {job.type}
                  </span>
                </div>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <a 
                href={job.apply_url} 
                target="_blank" 
                rel="noopener noreferrer"
                className="flex-grow md:flex-grow-0 bg-indigo-600 text-white font-bold px-8 py-3 rounded-xl hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-200 flex items-center gap-2"
              >
                Apply via Referral
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                </svg>
              </a>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 sm:px-6 lg:px-8 mt-12">
        <div className="flex flex-col lg:flex-row gap-12">
          {/* Main Content */}
          <div className="flex-grow max-w-4xl">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 md:p-12 mb-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-6">Job Description</h2>
              <div 
                className="prose prose-indigo max-w-none text-gray-600 leading-relaxed"
                dangerouslySetInnerHTML={{ __html: job.description }}
              />
              
              <div className="mt-12 pt-12 border-t border-gray-100">
                <h3 className="text-xl font-bold text-gray-900 mb-6">Benefits & Perks</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {job.benefits.map((benefit, index) => (
                    <div key={index} className="flex items-start">
                      <svg className="h-5 w-5 text-green-500 mr-3 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      <span className="text-gray-600">{benefit}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <aside className="w-full lg:w-80 flex-shrink-0">
            <div className="space-y-6 sticky top-24">
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                <h3 className="font-bold text-gray-900 mb-4 uppercase text-xs tracking-wider">Job Overview</h3>
                <div className="space-y-4">
                  <div className="flex justify-between items-center py-2 border-b border-gray-50">
                    <span className="text-gray-500 text-sm">Date Posted</span>
                    <span className="text-gray-900 text-sm font-medium">{job.posted_at}</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-gray-50">
                    <span className="text-gray-500 text-sm">Openings</span>
                    <span className="text-gray-900 text-sm font-medium">{job.openings_count}</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-gray-50">
                    <span className="text-gray-500 text-sm">Pay</span>
                    <span className="text-indigo-700 text-sm font-bold">{job.salary}</span>
                  </div>
                  <div className="flex justify-between items-center py-2">
                    <span className="text-gray-500 text-sm">Referral Bonus</span>
                    <span className="text-emerald-600 text-sm font-bold">${job.referral_bonus}</span>
                  </div>
                </div>
                <a 
                  href={job.apply_url} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="w-full bg-indigo-600 text-white font-bold py-3 px-4 rounded-xl mt-6 block text-center hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-100"
                >
                  Apply Now
                </a>
              </div>

              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                <h3 className="font-bold text-gray-900 mb-4 uppercase text-xs tracking-wider">Required Skills</h3>
                <div className="flex flex-wrap gap-2">
                  {job.tags.map((tag, index) => (
                    <span key={index} className="bg-gray-50 text-gray-600 px-3 py-1 rounded-full text-xs font-medium border border-gray-100">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  )
}
