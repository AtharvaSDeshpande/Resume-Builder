/**
 * Job-application pipeline statuses (Open → Applied → Interviewing → Offer /
 * Rejected). Single source of truth for labels, ordering, and colors so badges,
 * filters, and status buttons all stay consistent.
 */
export const STATUS = {
  open: { label: 'Open', tone: 'slate' },
  applied: { label: 'Applied', tone: 'blue' },
  interviewing: { label: 'Interviewing', tone: 'indigo' },
  offer: { label: 'Offer', tone: 'emerald' },
  rejected: { label: 'Rejected', tone: 'red' },
}

/** Pipeline order (also the filter/column order on the Applications page). */
export const STATUS_ORDER = ['open', 'applied', 'interviewing', 'offer', 'rejected']

export const statusLabel = (s) => STATUS[s]?.label || 'Open'

/** Tailwind classes for a status badge, keyed by tone. */
export function statusBadgeClass(s) {
  const tone = STATUS[s]?.tone || 'slate'
  return (
    {
      slate: 'bg-slate-100 text-slate-600',
      blue: 'bg-blue-100 text-blue-700',
      indigo: 'bg-indigo-100 text-indigo-700',
      emerald: 'bg-emerald-100 text-emerald-700',
      red: 'bg-red-100 text-red-700',
    }[tone] || 'bg-slate-100 text-slate-600'
  )
}

export const statusDotClass = (s) =>
  ({ slate: 'bg-slate-400', blue: 'bg-blue-500', indigo: 'bg-indigo-500', emerald: 'bg-emerald-500', red: 'bg-red-500' }[
    STATUS[s]?.tone || 'slate'
  ])
