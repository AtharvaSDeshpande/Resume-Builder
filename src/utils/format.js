/** Small formatting helpers shared across pages. */

export function formatDate(d) {
  if (!d) return ''
  const date = typeof d === 'string' || typeof d === 'number' ? new Date(d) : d
  if (!date || Number.isNaN(date.getTime())) return String(d)
  return date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
}

/** e.g. "in 3 days", "today", "2 days ago" for an ISO/date value. */
export function relativeDay(d) {
  if (!d) return ''
  const date = new Date(d)
  if (Number.isNaN(date.getTime())) return ''
  const day = 86400000
  const diff = Math.round((new Date(date.toDateString()) - new Date(new Date().toDateString())) / day)
  if (diff === 0) return 'today'
  if (diff === 1) return 'tomorrow'
  if (diff === -1) return 'yesterday'
  return diff > 0 ? `in ${diff} days` : `${-diff} days ago`
}
