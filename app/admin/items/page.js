import { query } from '@/lib/db'

export const dynamic = 'force-dynamic'

async function fetchItems() {
  const items = await query(
    `SELECT id, type, modality, primary_skill_code, secondary_skill_codes,
            prompt, expected_time_s, difficulty_beta, discrimination_alpha,
            n_administered, status, tags, created_at
     FROM items
     ORDER BY created_at DESC`
  ).catch(() => ({ rows: [] }))
  return items.rows || []
}

const TYPE_COLORS = {
  scenario_response: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  coding:            'bg-emerald-50 text-emerald-700 border-emerald-200',
  mcq:               'bg-amber-50 text-amber-700 border-amber-200',
  voice_response:    'bg-purple-50 text-purple-700 border-purple-200',
  video_response:    'bg-pink-50 text-pink-700 border-pink-200',
  system_design:     'bg-cyan-50 text-cyan-700 border-cyan-200',
}

const STATUS_COLORS = {
  draft:       'bg-slate-100 text-slate-600',
  calibrating: 'bg-amber-100 text-amber-700',
  live:        'bg-emerald-100 text-emerald-700',
  retired:     'bg-red-100 text-red-700',
}

export default async function AdminItemsPage() {
  const items = await fetchItems()

  const byType = items.reduce((acc, item) => {
    acc[item.type] = (acc[item.type] || 0) + 1
    return acc
  }, {})

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Item Bank</h1>
        <p className="text-slate-500 mt-1">
          {items.length} assessment items across {Object.keys(byType).length} types. Every item is a question/task with psychometric parameters (IRT: α discrimination · β difficulty).
        </p>
      </div>

      {/* Type breakdown */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {Object.entries(byType).map(([type, count]) => (
          <div key={type} className={`rounded-2xl border p-4 ${TYPE_COLORS[type] || 'bg-slate-50 text-slate-700 border-slate-200'}`}>
            <p className="text-xs font-black uppercase tracking-widest opacity-70">{type.replace(/_/g, ' ')}</p>
            <p className="text-2xl font-bold mt-1">{count}</p>
          </div>
        ))}
      </div>

      {/* Items list */}
      <div className="space-y-3">
        {items.map((item) => (
          <div key={item.id} className="bg-white rounded-2xl border border-slate-200 p-5 hover:border-slate-300 transition-colors">
            <div className="flex items-start justify-between gap-4 mb-3">
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded border ${TYPE_COLORS[item.type] || 'bg-slate-50 text-slate-700 border-slate-200'}`}>
                  {item.type.replace(/_/g, ' ')}
                </span>
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                  · {item.modality}
                </span>
                <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded ${STATUS_COLORS[item.status]}`}>
                  {item.status}
                </span>
                <span className="text-[10px] font-mono text-slate-400 truncate max-w-[280px]">
                  {item.primary_skill_code}
                </span>
              </div>
              <div className="flex items-center gap-4 text-xs text-slate-500 shrink-0">
                <span title="Item Response Theory parameters">
                  <span className="font-mono">α={item.discrimination_alpha?.toFixed(2) ?? '—'}</span>
                  {' · '}
                  <span className="font-mono">β={item.difficulty_beta?.toFixed(2) ?? '—'}</span>
                </span>
                <span title="Times administered">
                  n={item.n_administered}
                </span>
                <span title="Expected time">
                  ~{Math.round(item.expected_time_s / 60)}min
                </span>
              </div>
            </div>

            <p className="text-sm text-slate-800 leading-relaxed whitespace-pre-wrap">
              {item.prompt.length > 400 ? item.prompt.slice(0, 400) + '…' : item.prompt}
            </p>

            {item.secondary_skill_codes && item.secondary_skill_codes.length > 0 && (
              <div className="mt-3 flex items-center gap-2 flex-wrap">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Also measures:</span>
                {item.secondary_skill_codes.map((s) => (
                  <span key={s} className="text-[10px] font-mono text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">{s}</span>
                ))}
              </div>
            )}

            {item.tags && item.tags.length > 0 && (
              <div className="mt-2 flex items-center gap-2 flex-wrap">
                {item.tags.map((t) => (
                  <span key={t} className="text-[10px] text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded">#{t}</span>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {items.length === 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center">
          <p className="text-slate-500 text-sm">No items in the bank yet. Run <code className="bg-slate-100 px-2 py-1 rounded text-xs">node scripts/seed-swe-backend.mjs</code> to seed.</p>
        </div>
      )}
    </div>
  )
}
