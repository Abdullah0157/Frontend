import { query } from '@/lib/db'

export const dynamic = 'force-dynamic'

async function fetchSkills() {
  const skills = await query(
    `SELECT s.code, s.label, s.domain, s.subdomain, s.description,
            (SELECT COUNT(*)::int FROM items i
             WHERE i.status = 'live' AND (i.primary_skill_code = s.code OR s.code = ANY(i.secondary_skill_codes))
            ) AS item_count
     FROM skills s
     ORDER BY s.domain, s.subdomain, s.label`
  ).catch(() => ({ rows: [] }))

  // Group by domain → subdomain
  const grouped = {}
  for (const row of skills.rows) {
    const d = row.domain
    const s = row.subdomain || '_'
    grouped[d] ??= {}
    grouped[d][s] ??= []
    grouped[d][s].push(row)
  }
  return grouped
}

const DOMAIN_COLORS = {
  engineering: 'from-indigo-500 to-blue-600',
  product:     'from-purple-500 to-pink-600',
  sales:       'from-amber-500 to-orange-600',
  behavioral:  'from-emerald-500 to-teal-600',
}

const DOMAIN_LABELS = {
  engineering: 'Engineering',
  product:     'Product',
  sales:       'Sales',
  behavioral:  'Behavioral',
}

export default async function AdminSkillsPage() {
  const grouped = await fetchSkills()
  const totalSkills = Object.values(grouped).reduce(
    (sum, subs) => sum + Object.values(subs).reduce((s, arr) => s + arr.length, 0), 0
  )

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Skill Taxonomy</h1>
        <p className="text-slate-500 mt-1">
          {totalSkills} specific skills across {Object.keys(grouped).length} areas. Every candidate gets a running ability score for each skill, which carries over across all their interviews.
        </p>
      </div>

      <div className="space-y-8">
        {Object.entries(grouped).map(([domain, subdomains]) => (
          <div key={domain}>
            <div className="flex items-center gap-3 mb-4">
              <div className={`w-2 h-8 rounded bg-gradient-to-b ${DOMAIN_COLORS[domain] || 'from-slate-400 to-slate-600'}`} />
              <h2 className="text-xl font-bold text-slate-900">{DOMAIN_LABELS[domain] || domain}</h2>
              <span className="text-xs font-black uppercase tracking-widest text-slate-400">
                {Object.values(subdomains).reduce((s, arr) => s + arr.length, 0)} skills
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {Object.entries(subdomains).map(([subdomain, skills]) => (
                <div key={subdomain} className="bg-white rounded-2xl border border-slate-200 p-5">
                  <p className="text-xs font-black uppercase tracking-widest text-slate-500 mb-3 capitalize">
                    {subdomain === '_' ? '—' : subdomain.replace(/_/g, ' ')}
                  </p>
                  <div className="space-y-2">
                    {skills.map((s) => (
                      <div key={s.code} className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-slate-900 truncate">{s.label}</p>
                          <p className="text-[10px] font-mono text-slate-400 truncate">{s.code}</p>
                        </div>
                        <span className={`text-xs font-bold px-2 py-0.5 rounded shrink-0 ${
                          s.item_count > 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-400'
                        }`}>
                          {s.item_count} {s.item_count === 1 ? 'question' : 'questions'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
