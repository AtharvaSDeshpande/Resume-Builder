import React from 'react'

/** Shared, professional building blocks for agent insight views. */

export function Bullets({ items, tone = 'slate' }) {
  if (!items?.length) return null
  const dot = { slate: 'bg-slate-300', accent: 'bg-accent', emerald: 'bg-emerald-400', amber: 'bg-amber-400' }[tone]
  return (
    <ul className="space-y-1.5 text-sm leading-relaxed text-slate-600">
      {items.map((it, i) => (
        <li key={i} className="flex gap-2.5">
          <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${dot}`} />
          <span>{it}</span>
        </li>
      ))}
    </ul>
  )
}

export function Chips({ items, tone = 'slate' }) {
  if (!items?.length) return null
  const cls = {
    slate: 'bg-slate-100 text-slate-600',
    accent: 'bg-accent/10 text-accent',
    emerald: 'bg-emerald-50 text-emerald-700',
    amber: 'bg-amber-50 text-amber-700',
  }[tone]
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

export function Prose({ children }) {
  if (!children) return null
  return <p className="text-sm leading-relaxed text-slate-600">{children}</p>
}

/** Numbered "talking points" style list that stands out. */
export function NumberedList({ items }) {
  if (!items?.length) return null
  return (
    <ol className="space-y-2">
      {items.map((it, i) => (
        <li key={i} className="flex gap-3 rounded-lg bg-slate-50 p-2.5 text-sm text-slate-700">
          <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-accent/15 text-[11px] font-bold text-accent">
            {i + 1}
          </span>
          <span className="leading-snug">{it}</span>
        </li>
      ))}
    </ol>
  )
}

/** Cited sources footer (only when the agent grounded its answer on the web). */
export function Sources({ sources, grounded }) {
  if (grounded && sources?.length) {
    return (
      <div className="mt-2 border-t border-slate-100 pt-3">
        <div className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-slate-400">Sources</div>
        <ul className="space-y-1">
          {sources.map((s, i) => (
            <li key={i} className="truncate text-xs">
              <a href={s.url} target="_blank" rel="noreferrer" className="text-accent hover:underline">
                {s.title}
              </a>
            </li>
          ))}
        </ul>
      </div>
    )
  }
  if (!grounded) {
    return (
      <p className="mt-2 border-t border-slate-100 pt-3 text-[11px] text-slate-400">
        Generated from the model's knowledge — live web grounding wasn't available (needs a billing-enabled key).
      </p>
    )
  }
  return null
}
