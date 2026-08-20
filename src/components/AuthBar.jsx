import React from 'react'
import { useAuth } from '../auth/AuthContext.jsx'

/** Toolbar sign-in / signed-in indicator backed by Firebase Auth. */
export default function AuthBar() {
  const { isAuthenticated, user, signIn, signOut } = useAuth()

  if (!isAuthenticated) {
    return (
      <button
        onClick={signIn}
        className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm transition-colors hover:bg-slate-50"
      >
        Sign in
      </button>
    )
  }

  return (
    <div className="group relative flex items-center gap-2">
      {user?.picture ? (
        <img
          src={user.picture}
          alt=""
          className="h-8 w-8 rounded-full ring-2 ring-white"
          referrerPolicy="no-referrer"
        />
      ) : (
        <div className="grid h-8 w-8 place-items-center rounded-full bg-accent/10 text-xs font-bold text-accent">
          {(user?.name || user?.email || '?').charAt(0).toUpperCase()}
        </div>
      )}
      <div className="hidden text-left leading-tight sm:block">
        <div className="max-w-[130px] truncate text-xs font-semibold text-slate-700">
          {user?.name || user?.email}
        </div>
        <button onClick={signOut} className="text-[11px] text-slate-400 hover:text-slate-700">
          Sign out
        </button>
      </div>
      <button
        onClick={signOut}
        className="text-[11px] font-medium text-slate-400 hover:text-slate-700 sm:hidden"
      >
        Out
      </button>
    </div>
  )
}
