import { query } from '@/lib/db'

export const dynamic = 'force-dynamic'

async function fetchInterviews() {
  const res = await query(`
    SELECT
      ic.id, ic.name, ic.email, ic.created_at, ic.job_fit_score,
      ic.decision, ic.duration_seconds,
      ij.title AS job_title, ij.role AS job_role, ij.company AS company_name
    FROM interview_candidates ic
    LEFT JOIN interview_jobs ij ON ic.job_id = ij.id
    ORDER BY ic.created_at DESC
    LIMIT 200
  `).catch(() => ({ rows: [] }))
  return res.rows || []
}

function formatDuration(seconds) {
  if (!seconds) return '—'
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}m ${s}s`
}

export default async function AdminInterviewsPage() {
  const interviews = await fetchInterviews()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Interviews</h1>
        <p className="text-slate-500 mt-1">Every interview across every company. Showing latest 200.</p>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        {interviews.length === 0 ? (
          <p className="p-10 text-center text-slate-500 text-sm">No interviews yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500 text-xs font-black uppercase tracking-widest">
              <tr>
                <th className="text-left px-6 py-3">Candidate</th>
                <th className="text-left px-6 py-3">Role</th>
                <th className="text-left px-6 py-3">Company</th>
                <th className="text-right px-6 py-3">Score</th>
                <th className="text-right px-6 py-3">Duration</th>
                <th className="text-right px-6 py-3">Decision</th>
                <th className="text-right px-6 py-3">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {interviews.map((i) => (
                <tr key={i.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="font-medium text-slate-900">{i.name}</div>
                    {i.email && <div className="text-xs text-slate-500">{i.email}</div>}
                  </td>
                  <td className="px-6 py-4 text-slate-700">{i.job_title || i.job_role || '—'}</td>
                  <td className="px-6 py-4 text-slate-600">{i.company_name || '—'}</td>
                  <td className="px-6 py-4 text-right font-mono text-slate-700">
                    {i.job_fit_score != null ? `${i.job_fit_score}/10` : '—'}
                  </td>
                  <td className="px-6 py-4 text-right text-xs text-slate-600 font-mono">{formatDuration(i.duration_seconds)}</td>
                  <td className="px-6 py-4 text-right">
                    <span className={`text-xs font-bold uppercase tracking-widest px-2 py-1 rounded ${
                      i.decision === 'accepted' ? 'bg-emerald-50 text-emerald-700' :
                      i.decision === 'rejected' ? 'bg-red-50 text-red-700' :
                      'bg-slate-100 text-slate-600'
                    }`}>
                      {i.decision || 'pending'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right text-xs text-slate-500">{new Date(i.created_at).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
