import { redirect } from 'next/navigation'

// The site statistics page belongs to admins: /admin/analytics (login and
// super-admin role required). This public copy read from the old hosted
// backend, which is gone.
export default function AnalyticsMoved() {
  redirect('/admin/analytics')
}
