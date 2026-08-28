// Compensation formatting, shared by the public job board and the candidate
// dashboard so the two never disagree about how a rate is written.
//
// Roles are a mix of hourly contracts, fixed-price engagements and annual
// salaries. The unit is always shown, because "$60" reads as an hourly rate, a
// project fee or a (nonsensical) salary depending entirely on which it is.

const compact = (n) => (n >= 1000 ? `$${Math.round(n / 1000)}k` : `$${n}`)

export function formatPay(job) {
  const type = job?.pay_type
  const min = job?.pay_min
  const max = job?.pay_max
  if (!type || min == null) return null

  if (type === 'hourly') return max && max !== min ? `$${min}–$${max}/hr` : `$${min}/hr`
  if (type === 'fixed') return `${compact(min)} fixed price`
  return max && max !== min ? `${compact(min)}–${compact(max)}/yr` : `${compact(min)}/yr`
}

// Longer form for a job detail page, where there's room to be explicit.
export function formatPayLong(job) {
  const type = job?.pay_type
  const min = job?.pay_min
  const max = job?.pay_max
  if (!type || min == null) return null
  const money = (n) => `$${Number(n).toLocaleString('en-US')}`
  if (type === 'hourly') return max && max !== min ? `${money(min)} – ${money(max)} per hour` : `${money(min)} per hour`
  if (type === 'fixed') return `${money(min)} fixed price for the engagement`
  return max && max !== min ? `${money(min)} – ${money(max)} per year` : `${money(min)} per year`
}
