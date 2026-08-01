'use client'

// Client-side chart components using Recharts. Every chart ships with
// hover tooltips + legend interactivity out of the box.

import {
  AreaChart, Area,
  BarChart, Bar,
  PieChart, Pie, Cell,
  LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts'

const COLORS = {
  indigo:  '#6366f1',
  purple:  '#a855f7',
  pink:    '#ec4899',
  emerald: '#10b981',
  amber:   '#f59e0b',
  red:     '#ef4444',
  slate:   '#64748b',
  cyan:    '#06b6d4',
  blue:    '#3b82f6',
}

const CATEGORICAL = [COLORS.indigo, COLORS.emerald, COLORS.amber, COLORS.pink, COLORS.cyan, COLORS.purple]

// Consistent tooltip styling across every chart on the page.
function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-slate-200 rounded-lg shadow-xl px-3 py-2 text-xs">
      {label !== undefined && (
        <div className="font-semibold text-slate-900 mb-1">{label}</div>
      )}
      {payload.map((entry, i) => (
        <div key={i} className="flex items-center gap-2">
          <span className="inline-block w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: entry.color || entry.payload?.fill }} />
          <span className="text-slate-600">{entry.name}:</span>
          <span className="font-mono font-semibold text-slate-900">{entry.value}</span>
        </div>
      ))}
    </div>
  )
}

// ─── Interviews per day (last 14 days) — area chart ────────────────────────
export function InterviewsPerDayChart({ data }) {
  const formatted = data.map((d) => ({
    day: new Date(d.day).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
    interviews: d.n,
  }))
  return (
    <ResponsiveContainer width="100%" height={220}>
      <AreaChart data={formatted} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
        <defs>
          <linearGradient id="grad-interviews" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={COLORS.indigo} stopOpacity={0.4} />
            <stop offset="95%" stopColor={COLORS.indigo} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis dataKey="day" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={{ stroke: '#cbd5e1' }} />
        <YAxis tick={{ fontSize: 11, fill: '#64748b' }} axisLine={{ stroke: '#cbd5e1' }} />
        <Tooltip content={<ChartTooltip />} />
        <Area type="monotone" dataKey="interviews" stroke={COLORS.indigo} strokeWidth={2} fill="url(#grad-interviews)" />
      </AreaChart>
    </ResponsiveContainer>
  )
}

// ─── Decision breakdown — donut chart ──────────────────────────────────────
export function DecisionsDonut({ data }) {
  const formatted = data.map((d, i) => ({
    name: d.decision.charAt(0).toUpperCase() + d.decision.slice(1),
    value: d.n,
    color: d.decision === 'accepted' ? COLORS.emerald
      : d.decision === 'rejected' ? COLORS.red
      : COLORS.slate,
  }))
  const total = formatted.reduce((a, b) => a + b.value, 0)
  return (
    <div className="relative">
      <ResponsiveContainer width="100%" height={220}>
        <PieChart>
          <Pie
            data={formatted}
            cx="50%" cy="50%"
            innerRadius={60} outerRadius={90}
            paddingAngle={2}
            dataKey="value"
          >
            {formatted.map((entry, i) => (
              <Cell key={i} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip content={<ChartTooltip />} />
          <Legend
            verticalAlign="bottom"
            iconType="circle"
            wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
          />
        </PieChart>
      </ResponsiveContainer>
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none pb-8">
        <div className="text-2xl font-bold text-slate-900">{total}</div>
        <div className="text-[10px] font-black uppercase tracking-widest text-slate-500">Total</div>
      </div>
    </div>
  )
}

// ─── Score distribution — stacked bar per band ─────────────────────────────
export function ScoreDistributionBar({ data }) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis dataKey="band" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={{ stroke: '#cbd5e1' }} />
        <YAxis tick={{ fontSize: 11, fill: '#64748b' }} axisLine={{ stroke: '#cbd5e1' }} />
        <Tooltip content={<ChartTooltip />} cursor={{ fill: '#f1f5f9' }} />
        <Bar dataKey="count" radius={[8, 8, 0, 0]}>
          {data.map((entry, i) => (
            <Cell key={i} fill={entry.color || COLORS.indigo} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

// ─── User breakdown — donut chart (companies vs candidates vs admins) ──────
export function UsersDonut({ data }) {
  const formatted = data.map((d, i) => ({
    name: d.name,
    value: d.value,
    color: CATEGORICAL[i % CATEGORICAL.length],
  }))
  const total = formatted.reduce((a, b) => a + b.value, 0)
  return (
    <div className="relative">
      <ResponsiveContainer width="100%" height={220}>
        <PieChart>
          <Pie
            data={formatted}
            cx="50%" cy="50%"
            innerRadius={60} outerRadius={90}
            paddingAngle={2}
            dataKey="value"
          >
            {formatted.map((entry, i) => (
              <Cell key={i} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip content={<ChartTooltip />} />
          <Legend
            verticalAlign="bottom"
            iconType="circle"
            wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
          />
        </PieChart>
      </ResponsiveContainer>
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none pb-8">
        <div className="text-2xl font-bold text-slate-900">{total}</div>
        <div className="text-[10px] font-black uppercase tracking-widest text-slate-500">Users</div>
      </div>
    </div>
  )
}

// ─── Growth over time — stacked area chart (companies + candidates) ────────
export function GrowthStackedArea({ data }) {
  const formatted = data.map((d) => ({
    day: new Date(d.day).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
    Companies: d.companies || 0,
    Candidates: d.candidates || 0,
  }))
  return (
    <ResponsiveContainer width="100%" height={260}>
      <AreaChart data={formatted} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
        <defs>
          <linearGradient id="grad-companies" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={COLORS.emerald} stopOpacity={0.6} />
            <stop offset="95%" stopColor={COLORS.emerald} stopOpacity={0.05} />
          </linearGradient>
          <linearGradient id="grad-candidates" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={COLORS.indigo} stopOpacity={0.6} />
            <stop offset="95%" stopColor={COLORS.indigo} stopOpacity={0.05} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis dataKey="day" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={{ stroke: '#cbd5e1' }} />
        <YAxis tick={{ fontSize: 11, fill: '#64748b' }} axisLine={{ stroke: '#cbd5e1' }} />
        <Tooltip content={<ChartTooltip />} />
        <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
        <Area type="monotone" dataKey="Companies" stackId="1" stroke={COLORS.emerald} strokeWidth={2} fill="url(#grad-companies)" />
        <Area type="monotone" dataKey="Candidates" stackId="1" stroke={COLORS.indigo} strokeWidth={2} fill="url(#grad-candidates)" />
      </AreaChart>
    </ResponsiveContainer>
  )
}
