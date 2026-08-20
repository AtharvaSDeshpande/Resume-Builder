import React, { useEffect } from 'react'

/**
 * Accessible modal dialog. Full-screen sheet on mobile, centered card on
 * desktop. Closes on Escape or overlay click. `footer` renders a sticky action
 * bar; `children` is the scrollable body.
 */
export default function Modal({ title, subtitle, onClose, footer, children, maxWidth = 'max-w-lg' }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [onClose])

  return (
    <div
      className="app-overlay anim-fade fixed inset-0 z-50 flex items-stretch justify-center bg-slate-900/50 backdrop-blur-sm sm:items-center sm:p-4"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div
        className={`anim-pop flex w-full ${maxWidth} flex-col overflow-hidden bg-white shadow-2xl sm:rounded-2xl sm:max-h-[88vh]`}
      >
        <header className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <div className="min-w-0">
            <h2 className="truncate text-base font-bold text-slate-900">{title}</h2>
            {subtitle && <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>}
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="-mr-1 grid h-8 w-8 shrink-0 place-items-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
            </svg>
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-auto px-5 py-4">{children}</div>

        {footer && (
          <footer className="flex items-center justify-end gap-2 border-t border-slate-100 bg-slate-50/80 px-5 py-3">
            {footer}
          </footer>
        )}
      </div>
    </div>
  )
}
