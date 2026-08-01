import Link from 'next/link'
import { query } from '@/lib/db'

export const dynamic = 'force-dynamic'

async function fetchCompanies() {
  const res = await query(`
    SELECT
      cp.user_id,
      cp.company_name,
      cp.website,
      cp.industry,
      cp.created_at,
      (SELECT COUNT(*)::int FROM interview_jobs ij WHERE ij.owner_id = cp.user_id) AS job_count,
      (SELECT COUNT(*)::int FROM interview_candidates ic
        JOIN interview_jobs ij2 ON ic.job_id = ij2.id
        WHERE ij2.owner_id = cp.user_id) AS candidate_count
    FROM company_profiles cp
    ORDER BY cp.created_at DESC
  `).catch(() => ({ rows: [] }))
  return res.rows || []
}

export default async function AdminCompaniesPage() {
  const companies = await fetchCompanies()

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Companies</h1>
          <p className="text-slate-500 mt-1">{companies.length} companies on the platform.</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        {companies.length === 0 ? (
          <p className="p-10 text-center text-slate-500 text-sm">No companies yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500 text-xs font-black uppercase tracking-widest">
              <tr>
                <th className="text-left px-6 py-3">Company</th>
                <th className="text-left px-6 py-3">Industry</th>
                <th className="text-right px-6 py-3">Jobs</th>
                <th className="text-right px-6 py-3">Candidates</th>
                <th className="text-right px-6 py-3">Joined</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {companies.map((c) => (
                <tr key={c.user_id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="font-medium text-slate-900">{c.company_name}</div>
                    {c.website && <a href={c.website} className="text-xs text-indigo-600 hover:underline" target="_blank" rel="noreferrer">{c.website}</a>}
                  </td>
                  <td className="px-6 py-4 text-slate-600">{c.industry || '—'}</td>
                  <td className="px-6 py-4 text-right font-mono text-slate-700">{c.job_count}</td>
                  <td className="px-6 py-4 text-right font-mono text-slate-700">{c.candidate_count}</td>
                  <td className="px-6 py-4 text-right text-xs text-slate-500">{new Date(c.created_at).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
