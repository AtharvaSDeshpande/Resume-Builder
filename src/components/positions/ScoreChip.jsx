import React from 'react'

const tone = (score) => (score >= 85 ? 'emerald' : score >= 70 ? 'amber' : 'red')
const TEXT = { emerald: 'text-emerald-700', amber: 'text-amber-700', red: 'text-red-600' }
const BG = { emerald: 'bg-emerald-100', amber: 'bg-amber-100', red: 'bg-red-100' }
const BAR = { emerald: 'bg-emerald-500', amber: 'bg-amber-500', red: 'bg-red-500' }

/** Compact fit-score pill. */
export function ScoreChip({ score }) {
  const t = tone(score)
  return (
    <span className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold ${BG[t]} ${TEXT[t]}`}>
      {score}
      <span className="text-[10px] font-semibold opacity-70">/100</span>
    </span>
  )
}

/** Larger score meter with a bar (for the Feedback view). */
export function ScoreMeter({ score }) {
  const t = tone(score)
  return (
    <div className="rounded-xl border border-slate-200 p-4">
      <div className="flex items-baseline justify-between">
        <span className="text-xs font-semibold text-slate-500">JD fit score</span>
        <span className={`text-2xl font-black ${TEXT[t]}`}>
          {score}
          <span className="text-sm font-bold text-slate-300">/100</span>
        </span>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
        <div className={`h-full rounded-full ${BAR[t]}`} style={{ width: `${Math.max(4, Math.min(100, score))}%` }} />
      </div>
    </div>
  )
}
