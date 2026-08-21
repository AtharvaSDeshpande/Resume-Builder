import React, { useEffect, useState } from 'react'

/** Live agent-progress panel — current stage label, elapsed time, animated bar. */
export default function ProgressPanel({ progress }) {
  const [elapsed, setElapsed] = useState(0)
  useEffect(() => {
    const t = setInterval(() => setElapsed((e) => e + 1), 1000)
    return () => clearInterval(t)
  }, [])

  return (
    <div className="rounded-xl border border-accent/20 bg-accent/5 p-3">
      <div className="flex items-center gap-2">
        <Spinner />
        <span className="flex-1 text-xs font-medium text-slate-700">{progress?.label || 'Working…'}</span>
        <span className="text-[11px] tabular-nums text-slate-400">{elapsed}s</span>
      </div>
      <div className="mt-2 h-1 overflow-hidden rounded-full bg-accent/10">
        <div className="animate-indeterminate h-full w-1/3 rounded-full bg-accent" />
      </div>
      <p className="mt-2 text-[11px] leading-snug text-slate-400">
        The agent understands the role, tailors your résumé, then reviews and refines it — usually 20–60s.
      </p>
    </div>
  )
}

export function Spinner({ className = 'text-accent', size = 15 }) {
  return (
    <svg className={`animate-spin ${className}`} width={size} height={size} viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="3" opacity="0.25" />
      <path d="M21 12a9 9 0 00-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  )
}
