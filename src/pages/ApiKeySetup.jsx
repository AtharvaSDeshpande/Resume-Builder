import React, { useState } from 'react'
import { useAuth } from '../auth/AuthContext.jsx'
import { useApiKey } from '../byok/ApiKeyContext.jsx'
import Button from '../components/ui/Button.jsx'

const AI_STUDIO_URL = 'https://aistudio.google.com/app/apikey'

/**
 * BYOK setup + editor. Rendered full-screen as a mandatory first step right
 * after sign-in (when no key is linked), and again from Settings whenever the
 * user wants to swap in a different Google account's key.
 */
export default function ApiKeySetup({ onboarding = false }) {
  const { user, signOut } = useAuth()
  const { hasKey, hint, updatedAt, saveKey, removeKey } = useApiKey()

  const [editing, setEditing] = useState(!hasKey)
  const [value, setValue] = useState('')
  const [show, setShow] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [removed, setRemoved] = useState(false)

  async function save() {
    const key = value.trim()
    if (!key) return setError('Paste your Gemini API key first.')
    setBusy(true)
    setError(null)
    try {
      await saveKey(key)
      setValue('')
      setEditing(false)
    } catch (err) {
      setError(err.message || 'Could not save the key.')
    } finally {
      setBusy(false)
    }
  }

  async function remove() {
    setBusy(true)
    setError(null)
    try {
      await removeKey()
      setRemoved(true)
      setEditing(true)
    } catch (err) {
      setError(err.message || 'Could not remove the key.')
    } finally {
      setBusy(false)
    }
  }

  const card = (
    <div className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
      <div className="flex items-center gap-3">
        <div className="grid h-11 w-11 place-items-center rounded-2xl bg-accent/10 text-accent">
          <KeyIcon />
        </div>
        <div>
          <h1 className="text-lg font-bold tracking-tight text-slate-900">
            {onboarding ? 'Connect your Gemini API key' : 'Gemini API key'}
          </h1>
          <p className="text-xs text-slate-500">
            {onboarding ? 'One quick step before you start — this is a bring-your-own-key app.' : 'Manage the key used for all AI features.'}
          </p>
        </div>
      </div>

      {/* Why */}
      <div className="mt-5 rounded-xl bg-slate-50 p-4 text-sm leading-relaxed text-slate-600">
        This app runs entirely on <span className="font-semibold text-slate-800">your own</span> free Google Gemini key,
        so all AI usage, rate limits, and billing stay on your Google account — we never charge you or share a key. The
        key is generated for free at Google AI Studio.
      </div>

      {/* Current key (settings, when linked) */}
      {hasKey && !editing && (
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
          <div className="text-sm">
            <div className="font-semibold text-emerald-800">Key linked</div>
            <div className="mt-0.5 font-mono text-xs text-emerald-700">{hint}</div>
            {updatedAt && <div className="mt-0.5 text-[11px] text-emerald-600">Updated {new Date(updatedAt).toLocaleDateString()}</div>}
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="secondary" onClick={() => { setEditing(true); setRemoved(false) }}>
              Replace key
            </Button>
            <Button size="sm" variant="subtle" disabled={busy} onClick={remove}>
              Remove
            </Button>
          </div>
        </div>
      )}

      {/* How-to + form */}
      {editing && (
        <>
          <ol className="mt-5 space-y-2 text-sm text-slate-600">
            <Step n={1}>
              Open{' '}
              <a href={AI_STUDIO_URL} target="_blank" rel="noreferrer" className="font-semibold text-accent hover:underline">
                Google AI Studio → API keys
              </a>{' '}
              and sign in with your Google account.
            </Step>
            <Step n={2}>Click <span className="font-semibold">Create API key</span> (a free key is fine to start).</Step>
            <Step n={3}>Copy the key (it looks like <span className="font-mono text-xs">AIza…</span>) and paste it below.</Step>
          </ol>

          <div className="mt-4">
            <label className="mb-1 block text-xs font-semibold text-slate-600">Gemini API key</label>
            <div className="flex gap-2">
              <input
                type={show ? 'text' : 'password'}
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder="AIzaSy…"
                autoComplete="off"
                spellCheck={false}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-sm focus:border-accent focus:ring-2 focus:ring-accent/20"
              />
              <Button variant="secondary" type="button" onClick={() => setShow((s) => !s)}>
                {show ? 'Hide' : 'Show'}
              </Button>
            </div>
            {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
            {removed && !error && <p className="mt-2 text-xs text-slate-500">Previous key removed. Paste a new one to continue.</p>}

            <div className="mt-3 flex items-center gap-2">
              <Button disabled={busy} onClick={save}>
                {busy ? 'Verifying…' : hasKey ? 'Save new key' : 'Verify & save key'}
              </Button>
              {hasKey && !removed && (
                <Button variant="subtle" type="button" disabled={busy} onClick={() => { setEditing(false); setValue(''); setError(null) }}>
                  Cancel
                </Button>
              )}
            </div>
          </div>
        </>
      )}

      {/* Privacy */}
      <div className="mt-6 flex gap-2.5 rounded-xl border border-slate-200 p-3.5 text-[11px] leading-relaxed text-slate-500">
        <LockIcon />
        <p>
          <span className="font-semibold text-slate-600">Your key is encrypted (AES-256-GCM) before it's stored</span>, and
          only ever decrypted on our server to call Gemini on your behalf. It's tied to your account, never shown back in
          the browser or to other users, and you can remove it anytime — which permanently deletes it.
        </p>
      </div>

      {onboarding && (
        <div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-4 text-xs text-slate-400">
          <span>Signed in as {user?.email}</span>
          <button onClick={signOut} className="font-medium text-slate-500 hover:text-slate-700">
            Sign out
          </button>
        </div>
      )}
    </div>
  )

  if (!onboarding) return <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6">{card}</div>

  return (
    <div className="grid min-h-screen place-items-center bg-slate-100 px-4 py-10">{card}</div>
  )
}

function Step({ n, children }) {
  return (
    <li className="flex gap-2.5">
      <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-accent/10 text-[11px] font-bold text-accent">
        {n}
      </span>
      <span>{children}</span>
    </li>
  )
}

function KeyIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="8" cy="15" r="4" />
      <path d="M10.8 12.2L20 3m-4 1l2 2m-5 1l2 2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
function LockIcon() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="shrink-0 text-slate-400">
      <rect x="5" y="11" width="14" height="9" rx="2" />
      <path d="M8 11V8a4 4 0 018 0v3" strokeLinecap="round" />
    </svg>
  )
}
