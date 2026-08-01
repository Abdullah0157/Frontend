import { query } from '@/lib/db'

export const dynamic = 'force-dynamic'

async function fetchCandidates() {
  const res = await query(`
    SELECT
      up.user_id,
      up.full_name,
      up.resume_filename,
      up.resume_pages,
      up.created_at,
      up.updated_at,
      (SELECT COUNT(*)::int FROM interview_candidates ic WHERE ic.user_id = up.user_id) AS interview_count
    FROM user_profiles up
    WHERE COALESCE(up.account_type, 'candidate') = 'candidate'
    ORDER BY up.updated_at DESC
    LIMIT 200
  `).catch(() => ({ rows: [] }))
  return res.rows || []
}

export default async function AdminCandidatesPage() {
  const candidates = await fetchCandidates()

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Candidates</h1>
          <p className="text-slate-500 mt-1">Showing {candidates.length} most recently active (max 200).</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        {candidates.length === 0 ? (
          <p className="p-10 text-center text-slate-500 text-sm">No candidates yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500 text-xs font-black uppercase tracking-widest">
              <tr>
                <th className="text-left px-6 py-3">Name</th>
                <th className="text-left px-6 py-3">Resume</th>
                <th className="text-right px-6 py-3">Interviews</th>
                <th className="text-right px-6 py-3">Signed up</th>
                <th className="text-right px-6 py-3">Last active</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {candidates.map((c) => (
                <tr key={c.user_id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4 font-medium text-slate-900">{c.full_name || '(no name)'}</td>
                  <td className="px-6 py-4 text-slate-600 text-xs">
                    {c.resume_filename ? (
                      <>
                        {c.resume_filename}
                        {c.resume_pages && <span className="text-slate-400 ml-2">· {c.resume_pages} pages</span>}
                      </>
                    ) : (
                      <span className="text-slate-400">no resume</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right font-mono text-slate-700">{c.interview_count}</td>
                  <td className="px-6 py-4 text-right text-xs text-slate-500">{new Date(c.created_at).toLocaleDateString()}</td>
                  <td className="px-6 py-4 text-right text-xs text-slate-500">{new Date(c.updated_at).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
