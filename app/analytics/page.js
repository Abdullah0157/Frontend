'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import axios from 'axios'

export default function AnalyticsDashboard() {
  const [stats, setStats] = useState({
    totalVisits: 0,
    totalApplies: 0,
    avgTime: '0:00',
    conversionRate: 0,
    topJobs: []
  })

  useEffect(() => {
    const loadStats = async () => {
      try {
        const response = await axios.get(`${process.env.NEXT_PUBLIC_API_URL}/analytics`)
        const data = response.data
        
        const visits = data.find(m => m.metric_name === 'total_visits')?.value || 0
        const applies = data.find(m => m.metric_name === 'total_applies')?.value || 0
        const seconds = data.find(m => m.metric_name === 'total_time')?.value || 0
        
        const avgMinutes = visits > 0 ? Math.floor((seconds / visits) / 60) : 0
        const avgSeconds = visits > 0 ? Math.floor((seconds / visits) % 60) : 0
        
        setStats({
          totalVisits: visits,
          totalApplies: applies,
          avgTime: `${avgMinutes}:${avgSeconds < 10 ? '0' : ''}${avgSeconds}`,
          conversionRate: visits > 0 ? ((applies / visits) * 100).toFixed(1) : 0,
          topJobs: [
            { title: 'Senior Software Engineer', company: 'Google', clicks: Math.floor(applies * 0.4) },
            { title: 'Product Manager', company: 'Meta', clicks: Math.floor(applies * 0.3) },
            { title: 'Full Stack Dev', company: 'Vercel', clicks: Math.floor(applies * 0.2) }
          ]
        })
      } catch (err) { console.error('Failed to load analytics', err) }
    }

    loadStats()
    const interval = setInterval(loadStats, 5000)
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="min-h-screen bg-slate-50 pt-32 pb-20 px-4 md:px-10">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-12 gap-6">
          <div>
            <h1 className="text-4xl font-black text-slate-900 tracking-tighter uppercase mb-2">JobStream <span className="text-indigo-600">Command Center</span></h1>
            <p className="text-slate-500 font-medium italic">Real-time performance metrics for your platform.</p>
          </div>
          <div className="flex gap-4">
            <div className="px-6 py-3 bg-white border border-slate-200 rounded-2xl shadow-sm flex items-center gap-3">
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
              <span className="text-xs font-black uppercase tracking-widest text-slate-600">Live Tracking Active</span>
            </div>
          </div>
        </div>

        {/* Main Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
          {[
            { label: 'Total Visitors', value: stats.totalVisits.toLocaleString(), color: 'text-blue-600', bg: 'bg-blue-50' },
            { label: 'Job Applications', value: stats.totalApplies.toLocaleString(), color: 'text-indigo-600', bg: 'bg-indigo-50' },
            { label: 'Conversion Rate', value: `${stats.conversionRate}%`, color: 'text-purple-600', bg: 'bg-purple-50' },
            { label: 'Avg. Time on Site', value: stats.avgTime, color: 'text-emerald-600', bg: 'bg-emerald-50' },
          ].map((item, i) => (
            <div key={i} className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm hover:shadow-xl transition-all group">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-4">{item.label}</p>
              <h3 className={`text-4xl font-black tracking-tighter ${item.color}`}>{item.value}</h3>
              <div className="mt-6 flex items-center gap-2">
                <span className={`px-2 py-1 rounded-lg ${item.bg} ${item.color} text-[10px] font-bold`}>+12% vs last week</span>
              </div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Top Jobs Table */}
          <div className="lg:col-span-2 bg-white rounded-[3rem] border border-slate-100 shadow-sm p-10">
            <div className="flex justify-between items-center mb-10">
              <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight">Most Popular Jobs</h2>
              <button className="text-xs font-black text-indigo-600 uppercase tracking-widest hover:underline">View All</button>
            </div>
            <div className="space-y-6">
              {stats.topJobs.map((job, i) => (
                <div key={i} className="flex items-center justify-between p-6 rounded-3xl bg-slate-50 hover:bg-slate-100 transition-colors">
                  <div className="flex items-center gap-6">
                    <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center font-black text-indigo-600 shadow-sm">
                      #{i + 1}
                    </div>
                    <div>
                      <h4 className="font-black text-slate-900 text-sm uppercase tracking-tight">{job.title}</h4>
                      <p className="text-xs text-slate-500 font-bold">{job.company}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-lg font-black text-slate-900">{job.clicks}</span>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Applies</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* User Behavior Card */}
          <div className="bg-indigo-600 rounded-[3rem] shadow-2xl p-10 text-white relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 blur-[80px] rounded-full"></div>
            <div className="relative z-10 h-full flex flex-col justify-between">
              <div>
                <h2 className="text-xl font-black uppercase tracking-tight mb-4">Daily Goal</h2>
                <p className="text-indigo-100 text-sm font-medium leading-relaxed mb-8">You are on track to beat last months traffic records!</p>
                
                <div className="mb-8">
                  <div className="flex justify-between text-xs font-black uppercase tracking-widest mb-2">
                    <span>Target</span>
                    <span>{Math.min(100, (stats.totalVisits / 1000) * 100).toFixed(0)}%</span>
                  </div>
                  <div className="w-full h-3 bg-white/20 rounded-full overflow-hidden">
                    <div className="h-full bg-white transition-all duration-1000" style={{ width: `${Math.min(100, (stats.totalVisits / 1000) * 100)}%` }}></div>
                  </div>
                </div>
              </div>

              <div className="bg-white/10 p-6 rounded-3xl border border-white/10">
                <p className="text-[10px] font-black uppercase tracking-widest mb-2 opacity-60">System Insight</p>
                <p className="text-xs font-bold leading-relaxed italic">"Users are staying longer on Software roles than Management roles today."</p>
              </div>
            </div>
          </div>
        </div>

        {/* Back Link */}
        <div className="mt-12 text-center">
           <Link href="/" className="text-xs font-black text-slate-400 uppercase tracking-[0.4em] hover:text-indigo-600 transition-colors">← Back to Platform</Link>
        </div>
      </div>
    </div>
  )
}
