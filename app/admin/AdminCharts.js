'use client'

// The admin's one chart: what happened on the site each day.

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'

const SERIES = [
  { key: 'signups', name: 'Sign-ups', color: '#6366f1' },
  { key: 'tests', name: 'Tests finished', color: '#10b981' },
  { key: 'interviews', name: 'Interviews', color: '#f59e0b' },
]

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-slate-200 rounded-lg shadow-xl px-3 py-2 text-xs">
      <div className="font-semibold text-slate-900 mb-1">{label}</div>
      {payload.map((entry) => (
        <div key={entry.dataKey} className="flex items-center gap-2">
          <span className="inline-block w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: entry.color }} />
          <span className="text-slate-600">{entry.name}:</span>
          <span className="font-mono font-semibold text-slate-900">{entry.value}</span>
        </div>
      ))}
    </div>
  )
}

// data: [{ day: 'YYYY-MM-DD', signups, tests, interviews }], oldest first.
export function ActivityChart({ data }) {
  const formatted = data.map((d) => ({
    ...d,
    label: new Date(`${d.day}T00:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' }),
  }))
  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={formatted} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
        <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={{ stroke: '#cbd5e1' }} interval="preserveStartEnd" minTickGap={24} />
        <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#64748b' }} axisLine={{ stroke: '#cbd5e1' }} />
        <Tooltip content={<ChartTooltip />} cursor={{ fill: '#f1f5f9' }} />
        <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
        {SERIES.map((s) => (
          <Bar key={s.key} dataKey={s.key} name={s.name} stackId="a" fill={s.color} maxBarSize={18} isAnimationActive={false} />
        ))}
      </BarChart>
    </ResponsiveContainer>
  )
}
