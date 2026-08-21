import React, { useState } from 'react'
import { NavLink } from 'react-router-dom'
import AuthBar from './AuthBar.jsx'

const NAV = [
  { to: '/positions', label: 'Positions', icon: BriefcaseIcon },
  { to: '/resumes', label: 'My Résumés', icon: DocIcon },
  { to: '/applications', label: 'Applications', icon: InboxIcon },
]

/** App chrome: a dark nav rail (drawer on mobile) + a top bar, wrapping pages. */
export default function AppShell({ children }) {
  const [drawer, setDrawer] = useState(false)

  return (
    <div className="workspace flex h-screen overflow-hidden">
      {drawer && (
        <div className="anim-fade fixed inset-0 z-40 bg-slate-900/50 md:hidden" onClick={() => setDrawer(false)} />
      )}
      <div
        className={`no-print app-sidebar z-40 h-full ${drawer ? 'fixed inset-y-0 left-0 anim-slide-left shadow-2xl' : 'hidden'} md:static md:block`}
      >
        <Rail onNavigate={() => setDrawer(false)} />
      </div>

      <main className="flex min-w-0 flex-1 flex-col">
        <header className="no-print app-toolbar flex items-center justify-between gap-2 border-b border-slate-200 bg-white/90 px-3 py-2.5 backdrop-blur sm:px-5">
          <button
            onClick={() => setDrawer(true)}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-slate-600 hover:bg-slate-100 md:hidden"
            aria-label="Open menu"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M4 6h16M4 12h16M4 18h16" strokeLinecap="round" />
            </svg>
          </button>
          <div className="min-w-0 flex-1" />
          <AuthBar />
        </header>

        <div className="min-h-0 flex-1 overflow-auto">{children}</div>
      </main>
    </div>
  )
}

function Rail({ onNavigate }) {
  return (
    <aside className="flex h-full w-64 shrink-0 flex-col bg-gradient-to-b from-slate-900 to-slate-950 text-slate-200">
      <div className="flex items-center gap-2.5 px-5 py-5">
        <div className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-accent to-accent-dark text-sm font-black text-white shadow-md shadow-accent/30">
          R
        </div>
        <div className="leading-tight">
          <div className="text-sm font-bold text-white">Résumé Studio</div>
          <div className="text-[11px] text-slate-400">Job application tracker</div>
        </div>
      </div>

      <nav className="flex-1 space-y-1 px-3 py-2">
        {NAV.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            onClick={onNavigate}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors ${
                isActive ? 'bg-accent text-white shadow-lg shadow-accent/20' : 'text-slate-300 hover:bg-white/5'
              }`
            }
          >
            <Icon />
            {label}
          </NavLink>
        ))}
      </nav>

      <div className="border-t border-white/10 px-5 py-3 text-[11px] text-slate-500">
        Private to your account
      </div>
    </aside>
  )
}

function BriefcaseIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="7" width="18" height="13" rx="2" />
      <path d="M8 7V5a2 2 0 012-2h4a2 2 0 012 2v2M3 12h18" strokeLinecap="round" />
    </svg>
  )
}
function DocIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M14 3v5h5" strokeLinejoin="round" />
      <path d="M6 3h8l5 5v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5a2 2 0 012-2zM9 13h6M9 17h4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
function InboxIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M4 13h4l2 3h4l2-3h4M4 13l2-8h12l2 8v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5z" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
