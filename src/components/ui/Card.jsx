import React from 'react'

/** Standard surface. Optional header (title + action) keeps sections uniform. */
export default function Card({ title, action, className = '', bodyClassName = 'p-4 sm:p-5', children }) {
  return (
    <section className={`rounded-2xl border border-slate-200 bg-white shadow-sm ${className}`}>
      {(title || action) && (
        <header className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3 sm:px-5">
          <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500">{title}</h3>
          {action}
        </header>
      )}
      <div className={bodyClassName}>{children}</div>
    </section>
  )
}
