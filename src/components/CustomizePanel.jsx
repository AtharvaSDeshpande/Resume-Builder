import React, { useEffect, useState } from 'react'
import { customizeResume } from '../ai/customizeResume.js'
import { saveResume } from '../services/resumesRepo.js'
import { agentApi } from '../services/agentApi.js'

/**
 * Tailoring cockpit. Calls the Express agent backend (parse JD → tailor →
 * critique → improve); the server enforces the daily quota and returns a
 * relevance score + JD coverage. Desktop: docked panel; mobile: full-screen.
 */
export default function CustomizePanel({ uid, resumes, baseId, onBaseChange, onPreview, isPreviewing, onSaved, onClose }) {
  const [jobDescription, setJobDescription] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [result, setResult] = useState(null)
  const [saving, setSaving] = useState(false)
  const [savedId, setSavedId] = useState(null)
  const [quota, setQuota] = useState(null)
  const [company, setCompany] = useState('')
  const [progress, setProgress] = useState(null) // { stage, label } from the agent

  const base = resumes.find((r) => r.id === baseId) || resumes[0]

  useEffect(() => {
    setResult(null)
    setError(null)
    setSavedId(null)
    setCompany('')
  }, [baseId])

  useEffect(() => {
    agentApi.quota().then(setQuota).catch(() => {})
  }, [uid])

  // enforced === false means the backend has no Admin creds (dev) — don't block.
  const outOfQuota = quota?.enforced ? quota.remaining <= 0 : false
  const canRun = base && jobDescription.trim().length > 20 && !loading && !outOfQuota

  async function handleCustomize() {
    setLoading(true)
    setError(null)
    setSavedId(null)
    setProgress({ stage: 'start', label: 'Starting…' })
    try {
      // The backend reserves quota, runs the agent (streaming progress), and
      // refunds on its own error.
      const res = await customizeResume({
        baseResume: base.profile,
        jobDescription,
        onProgress: (p) => setProgress(p),
      })
      setResult(res)
      if (res.company) setCompany(res.company)
      if (res.quota) setQuota(res.quota)
      onPreview(res.profile)
    } catch (err) {
      setError(err.message || 'Customization failed.')
      agentApi.quota().then(setQuota).catch(() => {})
    } finally {
      setLoading(false)
      setProgress(null)
    }
  }

  async function handleSave() {
    if (!result) return
    setSaving(true)
    setError(null)
    try {
      const id = await saveResume(uid, result.profile, 'tailored', { company })
      setSavedId(id)
      onSaved?.(id)
    } catch (err) {
      setError(err.message || 'Could not save to your account.')
    } finally {
      setSaving(false)
    }
  }

  function handleDownload() {
    if (!result) return
    const blob = new Blob([JSON.stringify(result.profile, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${result.profile.profileId}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="no-print fixed inset-0 z-40 flex md:static md:z-auto md:block md:w-[360px]">
      {/* mobile backdrop */}
      <div className="app-overlay flex-1 bg-slate-900/40 md:hidden" onClick={onClose} />

      <div className="anim-slide-right flex h-full w-full max-w-[360px] flex-col border-l border-slate-200 bg-white shadow-2xl md:max-w-none md:shadow-none">
        <div className="flex items-start justify-between gap-2 border-b border-slate-100 px-4 py-3.5">
          <div>
            <h2 className="flex items-center gap-1.5 text-sm font-bold text-slate-900">
              <Sparkle /> Tailor with Gemini
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">Your real experience, re-emphasised for a role.</p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-auto p-4">
          {!base ? (
            <p className="py-10 text-center text-xs text-slate-400">Add a résumé first, then tailor it.</p>
          ) : (
            <>
              <Labeled label="Base résumé">
                <select
                  value={base.id}
                  onChange={(e) => onBaseChange(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-sm focus:border-accent focus:ring-2 focus:ring-accent/20"
                >
                  {resumes.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
              </Labeled>

              <Labeled label="Job description">
                <textarea
                  value={jobDescription}
                  onChange={(e) => setJobDescription(e.target.value)}
                  rows={7}
                  placeholder="Paste the target job description here…"
                  className="w-full resize-y rounded-lg border border-slate-300 px-2.5 py-2 text-sm focus:border-accent focus:ring-2 focus:ring-accent/20"
                />
                <div className="mt-1 text-right text-[11px] text-slate-400">{jobDescription.trim().length} chars</div>
              </Labeled>

              {quota?.enforced && (
                <div
                  className={`flex items-center justify-between rounded-lg px-3 py-2 text-[11px] font-medium ${
                    outOfQuota ? 'bg-amber-50 text-amber-700' : 'bg-slate-50 text-slate-500'
                  }`}
                >
                  <span>Daily AI tailors</span>
                  <span>
                    {quota.used} / {quota.limit} used
                    {outOfQuota ? ' · resets tomorrow' : ` · ${quota.remaining} left`}
                  </span>
                </div>
              )}

              <button
                onClick={handleCustomize}
                disabled={!canRun}
                className="w-full rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-all enabled:hover:bg-accent-dark disabled:cursor-not-allowed disabled:opacity-40"
              >
                {loading ? 'Tailoring…' : outOfQuota ? 'Daily limit reached' : 'Customize for this job'}
              </button>

              {loading && <ProgressPanel progress={progress} />}

              {isPreviewing && !loading && (
                <button
                  onClick={() => onPreview(null)}
                  className="w-full rounded-lg border border-slate-300 px-4 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
                >
                  ← Revert canvas to base résumé
                </button>
              )}

              {error && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-2.5 text-[11px] leading-snug text-red-700">
                  {error}
                </div>
              )}

              {result && (
                <div className="space-y-3 border-t border-slate-100 pt-3">
                  {typeof result.score === 'number' && (
                    <div className="rounded-lg border border-slate-200 p-2.5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-slate-600">JD fit score</span>
                        <span className={`text-sm font-bold ${result.score >= 85 ? 'text-emerald-600' : result.score >= 70 ? 'text-amber-600' : 'text-flag'}`}>
                          {result.score}/100
                        </span>
                      </div>
                      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-100">
                        <div
                          className={`h-full rounded-full ${result.score >= 85 ? 'bg-emerald-500' : result.score >= 70 ? 'bg-amber-500' : 'bg-flag'}`}
                          style={{ width: `${Math.max(4, Math.min(100, result.score))}%` }}
                        />
                      </div>
                      {result.jdCoverage?.missing?.length > 0 && (
                        <p className="mt-1.5 text-[11px] leading-snug text-slate-400">
                          Not covered: {result.jdCoverage.missing.slice(0, 6).join(', ')}
                        </p>
                      )}
                    </div>
                  )}

                  <ValidationBadge validation={result.validation} />

                  <Section title="What changed">
                    <ul className="space-y-1.5">
                      {result.changeLog.length === 0 && <li className="text-xs text-slate-400">No change log returned.</li>}
                      {result.changeLog.map((c, i) => (
                        <li key={i} className="rounded-lg bg-slate-50 p-2 text-[11px] leading-snug">
                          <span className="font-semibold text-slate-700">{c.section}:</span>{' '}
                          <span className="text-slate-600">{c.change}</span>
                          {c.rationale && <div className="mt-0.5 text-slate-400">↳ {c.rationale}</div>}
                        </li>
                      ))}
                    </ul>
                  </Section>

                  {result.corrections?.length > 0 && (
                    <Section title="Integrity guards applied" tone="emerald">
                      <ul className="space-y-1 text-[11px] text-emerald-700">
                        {result.corrections.map((c, i) => (
                          <li key={i}>• {c}</li>
                        ))}
                      </ul>
                    </Section>
                  )}

                  <p className="text-[11px] text-slate-400">
                    {result.model} · prompt v{result.promptVersion} · {result.attempts} attempt(s)
                  </p>

                  <Labeled label="Company" hint="saved with the résumé">
                    <input
                      type="text"
                      value={company}
                      onChange={(e) => setCompany(e.target.value)}
                      placeholder="e.g. Google"
                      className="w-full rounded-lg border border-slate-300 px-2.5 py-2 text-sm focus:border-accent focus:ring-2 focus:ring-accent/20"
                    />
                    {company && (
                      <p className="mt-1 text-[11px] text-slate-400">
                        Saves as “{result.profile.profileName} — {company}”
                      </p>
                    )}
                  </Labeled>

                  <div className="flex gap-2">
                    <button
                      onClick={handleSave}
                      disabled={saving || Boolean(savedId)}
                      className="flex-1 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                    >
                      {savedId ? '✓ Saved' : saving ? 'Saving…' : 'Save to my résumés'}
                    </button>
                    <button
                      onClick={handleDownload}
                      className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50"
                    >
                      JSON
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

/** Live agent-progress panel shown below the button while tailoring runs. */
function ProgressPanel({ progress }) {
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
        The agent understands the role, tailors your résumé, then reviews and refines it — this usually takes 2-3mins.
      </p>
    </div>
  )
}

function Spinner() {
  return (
    <svg className="animate-spin text-accent" width="15" height="15" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="3" opacity="0.25" />
      <path d="M21 12a9 9 0 00-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  )
}

function Labeled({ label, hint, children }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold text-slate-600">
        {label} {hint && <span className="font-normal text-slate-400">({hint})</span>}
      </span>
      {children}
    </label>
  )
}

function Section({ title, tone, children }) {
  return (
    <div>
      <h3 className={`mb-1 text-xs font-bold uppercase tracking-wide ${tone === 'emerald' ? 'text-emerald-600' : 'text-slate-500'}`}>
        {title}
      </h3>
      {children}
    </div>
  )
}

function ValidationBadge({ validation }) {
  const ok = validation?.count === 0
  return (
    <div className={`rounded-lg px-3 py-2 text-xs font-medium ${ok ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
      {ok ? '✓ Satisfies all restrictions' : `⚠ ${validation.count} restriction issue(s) — review before saving`}
    </div>
  )
}

function Sparkle() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" className="text-accent">
      <path d="M12 2l1.9 5.1L19 9l-5.1 1.9L12 16l-1.9-5.1L5 9l5.1-1.9L12 2z" />
    </svg>
  )
}
