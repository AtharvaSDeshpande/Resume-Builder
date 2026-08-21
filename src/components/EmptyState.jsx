import React from 'react'

const ICONS = {
  briefcase: (
    <>
      <rect x="3" y="7" width="18" height="13" rx="2" />
      <path d="M8 7V5a2 2 0 012-2h4a2 2 0 012 2v2M3 12h18" strokeLinecap="round" />
    </>
  ),
  doc: (
    <>
      <path d="M14 3v5h5" strokeLinejoin="round" />
      <path d="M6 3h8l5 5v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5a2 2 0 012-2z" strokeLinejoin="round" />
    </>
  ),
}

/** Reusable empty-state block with an icon, message, and optional action. */
export default function EmptyState({ icon = 'doc', title, message, action }) {
  return (
    <div className="grid place-items-center rounded-2xl border border-dashed border-slate-200 bg-white/50 px-6 py-16 text-center">
      <div className="mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-white text-accent shadow-sm ring-1 ring-slate-100">
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          {ICONS[icon] || ICONS.doc}
        </svg>
      </div>
      <h3 className="text-base font-bold text-slate-800">{title}</h3>
      {message && <p className="mt-1 max-w-sm text-sm text-slate-500">{message}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}
