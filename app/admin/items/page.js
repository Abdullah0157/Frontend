import Link from 'next/link'
import { query } from '@/lib/db'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Questions — JobStream Admin' }

// The question bank the tests draw from, in plain words. The first part of a
// question's skill code says which area it tests.
const AREAS = {
  engineering: 'Software',
  english: 'English',
  workplace: 'Workplace',
  behavioral: 'Judgement',
  customer_service: 'Customer service',
}
const KINDS = {
  choice: { label: 'Multiple choice', types: ['mcq', 'multi_select'] },
  situation: { label: 'What would you do?', types: ['sjt'] },
  written: { label: 'Written answer', types: ['scenario_response'] },
  coding: { label: 'Coding task', types: ['coding'] },
  review: { label: 'Code review', types: ['code_review'] },
  speaking: { label: 'Speaking', types: ['speaking'] },
  listening: { label: 'Listening', types: ['listening'] },
  typing: { label: 'Typing', types: ['typing'] },
}
const kindOf = (type) => Object.entries(KINDS).find(([, k]) => k.types.includes(type))?.[0] || null
const PAGE = 40

// Prompts are stored with **bold** marks; show them as plain text, cut short.
function preview(prompt) {
  const t = String(prompt || '').replace(/\*\*/g, '')
  return t.length > 400 ? `${t.slice(0, 400)}…` : t
}

async function fetchQuestions({ area, kind, q, page }) {
  const where = []
  const args = []
  if (area) { args.push(area); where.push(`split_part(primary_skill_code, '.', 1) = $${args.length}`) }
  if (kind) { args.push(KINDS[kind].types); where.push(`type = ANY($${args.length}::text[])`) }
  if (q) { args.push(`%${q}%`); where.push(`prompt ILIKE $${args.length}`) }
  const cond = where.length ? `WHERE ${where.join(' AND ')}` : ''
  const [list, total, areas, kinds] = await Promise.all([
    query(
      `SELECT id, type, primary_skill_code, prompt, n_administered, status
       FROM items ${cond}
       ORDER BY split_part(primary_skill_code, '.', 1), type, created_at
       LIMIT ${PAGE} OFFSET ${(page - 1) * PAGE}`, args
    ).catch(() => ({ rows: [] })),
    query(`SELECT COUNT(*)::int AS n FROM items ${cond}`, args).catch(() => ({ rows: [{ n: 0 }] })),
    query(`SELECT split_part(primary_skill_code, '.', 1) AS area, COUNT(*)::int AS n FROM items GROUP BY 1`).catch(() => ({ rows: [] })),
    query(
      `SELECT type, COUNT(*)::int AS n FROM items ${area ? `WHERE split_part(primary_skill_code, '.', 1) = $1` : ''} GROUP BY 1`,
      area ? [area] : []
    ).catch(() => ({ rows: [] })),
  ])
  const kindCounts = {}
  for (const r of kinds.rows) { const k = kindOf(r.type); if (k) kindCounts[k] = (kindCounts[k] || 0) + r.n }
  return { rows: list.rows, total: total.rows[0]?.n || 0, areas: areas.rows, kindCounts }
}

export default async function AdminQuestionsPage({ searchParams }) {
  const area = AREAS[searchParams?.area] ? searchParams.area : null
  const kind = KINDS[searchParams?.kind] ? searchParams.kind : null
  const q = String(searchParams?.q || '').trim().slice(0, 100)
  const page = Math.max(1, Math.min(1000, parseInt(searchParams?.page, 10) || 1))
  const { rows, total, areas, kindCounts } = await fetchQuestions({ area, kind, q, page })
  const all = areas.reduce((a, r) => a + r.n, 0)
  const href = (over) => {
    const p = new URLSearchParams()
    const v = { area, kind, q, ...over }
    for (const k of ['area', 'kind', 'q', 'page']) if (v[k] && !(k === 'page' && v[k] === 1)) p.set(k, v[k])
    const s = p.toString()
    return `/admin/items${s ? `?${s}` : ''}`
  }
  const chip = (active) => `rounded-full border px-3 py-1.5 text-sm transition ${active ? 'border-indigo-600 bg-indigo-600 text-white' : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'}`

  return (
    <div className="max-w-5xl space-y-6">
      <div>
        <h1 className="text-[28px] font-semibold tracking-tight text-slate-900">Questions</h1>
        <p className="mt-1.5 text-slate-500">
          The {all} questions the tests draw from. Each test picks a different mix from here for every candidate.
        </p>
      </div>

      <nav aria-label="Area" className="flex flex-wrap gap-2">
        <Link href={href({ area: null, kind: null, page: 1 })} className={chip(!area)} aria-current={!area ? 'page' : undefined}>All {all}</Link>
        {Object.entries(AREAS).map(([key, label]) => {
          const n = areas.find((r) => r.area === key)?.n || 0
          if (!n) return null
          return <Link key={key} href={href({ area: key, kind: null, page: 1 })} className={chip(area === key)} aria-current={area === key ? 'page' : undefined}>{label} {n}</Link>
        })}
      </nav>

      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <nav aria-label="Kind of question" className="flex flex-wrap gap-2 text-sm">
          <Link href={href({ kind: null, page: 1 })} className={`rounded-lg px-2.5 py-1 ${!kind ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'}`}>Any kind</Link>
          {Object.entries(KINDS).map(([key, k]) => kindCounts[key] ? (
            <Link key={key} href={href({ kind: key, page: 1 })} className={`rounded-lg px-2.5 py-1 ${kind === key ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'}`}>
              {k.label} <span className={kind === key ? 'text-slate-300' : 'text-slate-500'}>{kindCounts[key]}</span>
            </Link>
          ) : null)}
        </nav>
        <form action="/admin/items" className="flex gap-2">
          {area && <input type="hidden" name="area" value={area} />}
          {kind && <input type="hidden" name="kind" value={kind} />}
          <label htmlFor="q" className="sr-only">Search questions</label>
          <input id="q" name="q" defaultValue={q} placeholder="Search the wording" className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm md:w-56" />
          <button className="rounded-lg bg-slate-900 px-3 py-1.5 text-sm font-medium text-white">Search</button>
        </form>
      </div>

      <p className="text-sm text-slate-500">
        {total === 0 ? 'No questions match.' : `Showing ${(page - 1) * PAGE + 1} to ${Math.min(page * PAGE, total)} of ${total}.`}
      </p>

      <ul className="space-y-3">
        {rows.map((item) => {
          const areaKey = String(item.primary_skill_code || '').split('.')[0]
          return (
            <li key={item.id} className="rounded-2xl border border-slate-200 bg-white p-5">
              <div className="mb-2 flex flex-wrap items-center gap-2 text-xs">
                <span className="rounded-full bg-indigo-50 px-2 py-0.5 font-medium text-indigo-700">{AREAS[areaKey] || areaKey}</span>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-700">{KINDS[kindOf(item.type)]?.label || item.type}</span>
                {item.status !== 'live' && <span className="rounded-full bg-amber-50 px-2 py-0.5 text-amber-700">Not in use ({item.status})</span>}
                <span className="ml-auto text-slate-500">Shown {item.n_administered || 0} time{item.n_administered === 1 ? '' : 's'}</span>
              </div>
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-800">
                {preview(item.prompt)}
              </p>
            </li>
          )
        })}
      </ul>

      {total > PAGE && (
        <nav aria-label="Pages" className="flex items-center justify-between text-sm">
          {page > 1 ? <Link href={href({ page: page - 1 })} className="font-medium text-indigo-600">← Previous</Link> : <span />}
          <span className="text-slate-500">Page {page} of {Math.ceil(total / PAGE)}</span>
          {page * PAGE < total ? <Link href={href({ page: page + 1 })} className="font-medium text-indigo-600">Next →</Link> : <span />}
        </nav>
      )}
    </div>
  )
}
