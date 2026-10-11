'use client'

import { useState } from 'react'

// Job search (design option A). Filters as you type; Enter does the same.
export default function SearchBar({ onSearch }) {
  const [query, setQuery] = useState('')

  const handleChange = (e) => {
    setQuery(e.target.value)
    onSearch?.({ query: e.target.value })
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    onSearch?.({ query })
  }

  return (
    <form onSubmit={handleSubmit} role="search" className="relative">
      <label htmlFor="job-search" className="sr-only">Search jobs</label>
      <svg className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
      </svg>
      <input
        id="job-search"
        type="search"
        placeholder="Search by job title, company or skill"
        value={query}
        onChange={handleChange}
        className="w-full rounded-xl border border-[#CDD2DA] bg-white py-3.5 pl-12 pr-4 text-base text-ink placeholder:text-muted focus:border-brand focus:outline-none focus:ring-4 focus:ring-brand/15"
      />
    </form>
  )
}
