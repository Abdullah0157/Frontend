'use client'

import { useState } from 'react'

export default function SearchBar({ onSearch }) {
  const [query, setQuery] = useState('')

  const [isFocused, setIsFocused] = useState(false)

  const handleChange = (e) => {
    const value = e.target.value
    setQuery(value)
    if (onSearch) {
      onSearch({ query: value })
    }
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    if (onSearch) {
      onSearch({ query })
    }
  }

  return (
    <form 
      onSubmit={handleSubmit} 
      className={`bg-white p-2 rounded-2xl border flex flex-col md:flex-row items-center gap-2 w-full h-full relative z-10 transition-all duration-300 ease-in-out ${
        isFocused 
          ? 'shadow-[0_0_40px_-10px_rgba(79,70,229,0.5)] border-indigo-400 scale-[1.01] -translate-y-1' 
          : 'shadow-2xl border-gray-100 hover:shadow-indigo-100 hover:-translate-y-0.5'
      }`}
    >
      <div className="flex-grow flex items-center px-6 w-full py-4 group">
        <svg 
          className={`h-6 w-6 mr-4 transition-all duration-300 ${
            isFocused ? 'text-indigo-600 scale-110 -rotate-12' : 'text-indigo-400 group-hover:scale-110 group-hover:text-indigo-500'
          }`} 
          fill="none" 
          viewBox="0 0 24 24" 
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={isFocused ? 3 : 2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          type="text"
          placeholder="Search by job title or skills..."
          value={query}
          onChange={handleChange}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          className="w-full focus:outline-none text-lg text-gray-800 font-medium bg-transparent placeholder-gray-400 transition-colors"
        />
      </div>
      <button 
        type="submit" 
        className={`w-full md:w-auto text-white font-black px-10 py-4 rounded-xl transition-all duration-300 shadow-lg whitespace-nowrap overflow-hidden relative ${
          isFocused ? 'bg-indigo-700 shadow-indigo-300/50' : 'bg-indigo-600 shadow-indigo-200/50 hover:bg-indigo-500'
        }`}
      >
        <span className="relative z-10">Find Jobs</span>
        {/* Subtle button shimmer on focus */}
        <div className={`absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent transition-all duration-1000 ease-in-out ${isFocused ? 'translate-x-full' : ''}`} />
      </button>
    </form>
  )
}
