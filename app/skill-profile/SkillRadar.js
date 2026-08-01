'use client'

// Client-side radar/spider chart for a candidate's top domain's skills.
// Modeled on app/admin/AdminCharts.js (ResponsiveContainer + Tooltip styling),
// adapted to the light theme this page uses.

import {
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar,
  Tooltip, ResponsiveContainer,
} from 'recharts'

function RadarTooltip({ active, payload }) {
  if (!active || !payload?.length) return null
  const p = payload[0]
  return (
    <div className="bg-white border border-slate-200 rounded-lg shadow-lg px-3 py-2 text-xs">
      <div className="font-semibold text-slate-900 mb-1">{p.payload.label}</div>
      <div className="flex items-center gap-2">
        <span className="inline-block w-2.5 h-2.5 rounded-sm bg-indigo-500" />
        <span className="text-slate-500">Proficiency:</span>
        <span className="font-mono font-semibold text-slate-900">{Math.round(p.value)}%</span>
      </div>
    </div>
  )
}

// data: [{ label, value }] where value is 0..100
export default function SkillRadar({ data }) {
  if (!data?.length) return null
  return (
    <ResponsiveContainer width="100%" height={320}>
      <RadarChart data={data} outerRadius="75%">
        <PolarGrid stroke="#e2e8f0" />
        <PolarAngleAxis dataKey="label" tick={{ fontSize: 11, fill: '#475569' }} />
        <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} />
        <Tooltip content={<RadarTooltip />} />
        <Radar
          name="Proficiency"
          dataKey="value"
          stroke="#6366f1"
          fill="#6366f1"
          fillOpacity={0.25}
          strokeWidth={2}
        />
      </RadarChart>
    </ResponsiveContainer>
  )
}
