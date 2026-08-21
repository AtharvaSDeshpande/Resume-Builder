import React from 'react'
import Card from '../ui/Card.jsx'
import { ScoreMeter } from './ScoreChip.jsx'

/** Saved feedback for a position: fit score, JD coverage, weaknesses, changes. */
export default function FeedbackView({ feedback, changeLog, corrections }) {
  if (!feedback || typeof feedback.score !== 'number') {
    return (
      <Card title="No feedback yet">
        <p className="text-sm text-slate-500">Tailor a résumé for this position to generate your JD-fit feedback.</p>
      </Card>
    )
  }

  const covered = feedback.jdCoverage?.covered || []
  const missing = feedback.jdCoverage?.missing || []
  const weaknesses = feedback.weaknesses || []

  return (
    <div className="space-y-4">
      <ScoreMeter score={feedback.score} />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Card title={`Covered (${covered.length})`}>
          <TagList items={covered} tone="emerald" empty="Nothing detected yet." />
        </Card>
        <Card title={`Not covered (${missing.length})`}>
          <TagList items={missing} tone="amber" empty="Great — nothing missing." />
        </Card>
      </div>

      {weaknesses.length > 0 && (
        <Card title="What to strengthen">
          <ul className="space-y-1.5 text-sm text-slate-600">
            {weaknesses.map((w, i) => (
              <li key={i} className="flex gap-2">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400" />
                {w}
              </li>
            ))}
          </ul>
        </Card>
      )}

      {changeLog?.length > 0 && (
        <Card title="What the AI changed">
          <ul className="space-y-2">
            {changeLog.map((c, i) => (
              <li key={i} className="rounded-lg bg-slate-50 p-2.5 text-xs leading-snug">
                <span className="font-semibold text-slate-700">{c.section}:</span>{' '}
                <span className="text-slate-600">{c.change}</span>
                {c.rationale && <div className="mt-0.5 text-slate-400">↳ {c.rationale}</div>}
              </li>
            ))}
          </ul>
        </Card>
      )}

      {corrections?.length > 0 && (
        <Card title="Integrity guards applied">
          <ul className="space-y-1 text-xs text-emerald-700">
            {corrections.map((c, i) => (
              <li key={i}>• {c}</li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  )
}

function TagList({ items, tone, empty }) {
  if (!items.length) return <p className="text-xs text-slate-400">{empty}</p>
  const cls =
    tone === 'emerald' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((it, i) => (
        <span key={i} className={`rounded-md px-2 py-0.5 text-[11px] font-medium ${cls}`}>
          {it}
        </span>
      ))}
    </div>
  )
}
