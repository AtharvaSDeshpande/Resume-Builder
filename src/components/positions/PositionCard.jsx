import React from 'react'
import { Link } from 'react-router-dom'
import { StatusBadge } from './PositionStatus.jsx'
import { formatDate } from '../../utils/format.js'
import { ScoreChip } from './ScoreChip.jsx'

/** A job position summary card, linking into its detail page. */
export default function PositionCard({ position, onDelete }) {
  const score = position.feedback?.score
  return (
    <div className="group relative flex flex-col rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="truncate text-sm font-bold text-slate-900">{position.company || 'Untitled role'}</h3>
          <p className="mt-0.5 line-clamp-2 text-xs leading-snug text-slate-500">{position.jobDescription}</p>
        </div>
        {typeof score === 'number' && <ScoreChip score={score} />}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <StatusBadge status={position.status} />
        {position.interviewDate && (
          <span className="text-[11px] text-slate-400">Interview {formatDate(position.interviewDate)}</span>
        )}
        {position.tailored && <span className="text-[11px] font-medium text-emerald-600">Résumé tailored</span>}
      </div>

      <div className="mt-4 flex items-center gap-2">
        <Link
          to={`/positions/${position.id}`}
          className="flex-1 rounded-lg bg-accent/10 px-3 py-1.5 text-center text-xs font-semibold text-accent transition-colors hover:bg-accent/15"
        >
          Open
        </Link>
        {onDelete && (
          <button
            onClick={() => onDelete(position)}
            aria-label="Delete position"
            className="grid h-7 w-7 place-items-center rounded-lg text-slate-400 opacity-0 transition-opacity hover:bg-red-50 hover:text-red-500 group-hover:opacity-100"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
            </svg>
          </button>
        )}
      </div>
    </div>
  )
}
