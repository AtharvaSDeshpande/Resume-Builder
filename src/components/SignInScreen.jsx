import React from 'react'
import { useAuth } from '../auth/AuthContext.jsx'

/** Full-screen sign-in gate. */
export default function SignInScreen() {
  const { signIn, error } = useAuth()
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-slate-950 px-5 py-10">
      {/* ambient brand glow */}
      <div className="pointer-events-none absolute -top-40 left-1/2 h-[520px] w-[520px] -translate-x-1/2 rounded-full bg-accent/25 blur-[120px]" />
      <div className="pointer-events-none absolute bottom-[-160px] right-[-80px] h-[420px] w-[420px] rounded-full bg-indigo-500/20 blur-[120px]" />

      <div className="anim-pop relative w-full max-w-sm rounded-3xl border border-white/10 bg-white/[0.06] p-8 text-center shadow-2xl backdrop-blur-xl">
        <div className="mx-auto mb-5 grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-accent to-accent-dark text-xl font-black text-white shadow-lg shadow-accent/30">
          R
        </div>
        <h1 className="text-2xl font-extrabold tracking-tight text-white">Résumé Studio</h1>
        <p className="mx-auto mt-2 max-w-xs text-sm leading-relaxed text-slate-300">
          Upload, refine, and AI-tailor your résumé — all on one pixel-perfect page.
        </p>

        <button
          onClick={signIn}
          className="mt-7 flex w-full items-center justify-center gap-2.5 rounded-xl bg-white px-4 py-3 text-sm font-semibold text-slate-800 shadow-lg transition-transform hover:-translate-y-0.5 active:translate-y-0"
        >
          <GoogleGlyph />
          Continue with Google
        </button>

        {error && <p className="mt-3 text-xs text-red-300">{error}</p>}

        <p className="mt-6 text-[11px] leading-relaxed text-slate-400">
          Your résumés are private to your account and visible only to you.
        </p>
      </div>
    </div>
  )
}

function GoogleGlyph() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden>
      <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9 3.6l6.7-6.7C35.6 2.4 30.2 0 24 0 14.6 0 6.5 5.4 2.5 13.2l7.9 6.1C12.3 13.2 17.7 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.1 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.4c-.5 2.9-2.1 5.3-4.6 7l7.1 5.5c4.2-3.9 6.2-9.6 6.2-16.5z" />
      <path fill="#FBBC05" d="M10.4 28.7c-.5-1.5-.8-3-.8-4.7s.3-3.2.8-4.7l-7.9-6.1C.9 16.5 0 20.1 0 24s.9 7.5 2.5 10.8l7.9-6.1z" />
      <path fill="#34A853" d="M24 48c6.2 0 11.5-2 15.3-5.5l-7.1-5.5c-2 1.3-4.6 2.1-8.2 2.1-6.3 0-11.7-3.7-13.6-9.1l-7.9 6.1C6.5 42.6 14.6 48 24 48z" />
    </svg>
  )
}
