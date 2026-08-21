import React from 'react'
import { STATUS, STATUS_ORDER, statusBadgeClass, statusDotClass, statusLabel } from '../../domain/status.js'

/** Small colored status pill. */
export function StatusBadge({ status, className = '' }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${statusBadgeClass(status)} ${className}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${statusDotClass(status)}`} />
      {statusLabel(status)}
    </span>
  )
}

/** Compact status dropdown for dense contexts (e.g. table rows). */
export function StatusSelect({ status, onChange }) {
  return (
    <select
      value={status}
      onChange={(e) => onChange(e.target.value)}
      onClick={(e) => e.stopPropagation()}
      className={`cursor-pointer rounded-full border-0 py-1 pl-2.5 pr-7 text-[11px] font-semibold outline-none focus:ring-2 focus:ring-accent/30 ${statusBadgeClass(status)}`}
    >
      {STATUS_ORDER.map((s) => (
        <option key={s} value={s} className="bg-white text-slate-700">
          {STATUS[s].label}
        </option>
      ))}
    </select>
  )
}

/**
 * Pipeline as a row of clickable pills — the current status is highlighted; the
 * others move the position to that stage. Wraps on small screens.
 */
export function StatusButtons({ status, onChange }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {STATUS_ORDER.map((s) => {
        const active = s === status
        return (
          <button
            key={s}
            onClick={() => !active && onChange(s)}
            aria-pressed={active}
            className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
              active ? `${statusBadgeClass(s)} ring-2 ring-offset-1 ring-current/30` : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
            }`}
          >
            {STATUS[s].label}
          </button>
        )
      })}
    </div>
  )
}
