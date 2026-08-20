import React, { useRef, useState } from 'react'

/**
 * The signed-in user's résumé list. Dark app-rail on desktop; the same markup is
 * placed inside a slide-in drawer on mobile by App. Users add résumés by
 * uploading a PDF/JSON (parsed + saved to Firestore).
 */
export default function Sidebar({
  resumes,
  activeId,
  onSelect,
  onDelete,
  onUpload,
  validationById,
  loading,
  onNavigate,
}) {
  const fileRef = useRef(null)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState(null)

  async function handleFile(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setUploadError(null)
    setUploading(true)
    try {
      await onUpload(file)
    } catch (err) {
      setUploadError(err.message || 'Could not read that résumé.')
    } finally {
      setUploading(false)
    }
  }

  function pick(id) {
    onSelect(id)
    onNavigate?.()
  }

  return (
    <aside className="app-sidebar flex h-full w-72 shrink-0 flex-col bg-gradient-to-b from-slate-900 to-slate-950 text-slate-200">
      {/* Brand */}
      <div className="flex items-center gap-2.5 px-5 py-5">
        <div className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-accent to-accent-dark text-sm font-black text-white shadow-md shadow-accent/30">
          R
        </div>
        <div className="leading-tight">
          <div className="text-sm font-bold text-white">Résumé Studio</div>
          <div className="text-[11px] text-slate-400">Private to your account</div>
        </div>
      </div>

      <div className="px-5 pb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
        My résumés
      </div>

      {/* List */}
      <nav className="flex-1 space-y-1 overflow-auto px-3 pb-3">
        {loading && <p className="px-2 py-3 text-xs text-slate-500">Loading…</p>}

        {!loading && resumes.length === 0 && (
          <p className="px-2 py-8 text-center text-xs leading-relaxed text-slate-500">
            No résumés yet.
            <br />
            Upload your résumé below to begin.
          </p>
        )}

        {resumes.map((r) => {
          const active = r.id === activeId
          const issues = validationById[r.id] ?? 0
          return (
            <div
              key={r.id}
              className={`group relative flex items-center gap-2 rounded-xl px-3 py-2.5 transition-colors ${
                active ? 'bg-accent text-white shadow-lg shadow-accent/20' : 'text-slate-300 hover:bg-white/5'
              }`}
            >
              <button onClick={() => pick(r.id)} className="min-w-0 flex-1 text-left">
                <span className="block truncate text-sm font-semibold">{r.name}</span>
                <span className={`mt-0.5 flex items-center gap-1.5 text-[11px] ${active ? 'text-white/75' : 'text-slate-500'}`}>
                  <span
                    className={`rounded px-1.5 py-px text-[10px] font-semibold uppercase tracking-wide ${
                      active ? 'bg-white/20' : r.source === 'tailored' ? 'bg-accent/20 text-accent-light' : 'bg-white/10'
                    }`}
                  >
                    {r.source === 'tailored' ? 'Tailored' : 'Uploaded'}
                  </span>
                  {r.role && <span className="truncate">{r.role}</span>}
                </span>
              </button>

              {issues > 0 && (
                <span
                  className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                    active ? 'bg-white/25 text-white' : 'bg-amber-400/15 text-amber-300'
                  }`}
                  title={`${issues} constraint issue(s)`}
                >
                  {issues}
                </span>
              )}
              <button
                onClick={() => onDelete(r)}
                aria-label="Delete résumé"
                className={`shrink-0 rounded-md p-1 opacity-0 transition-opacity group-hover:opacity-100 ${
                  active ? 'text-white/80 hover:text-white' : 'text-slate-500 hover:text-red-400'
                }`}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
                </svg>
              </button>
            </div>
          )
        })}
      </nav>

      {/* Upload */}
      <div className="border-t border-white/10 p-3">
        <input ref={fileRef} type="file" accept=".pdf,application/pdf,.json,application/json" onChange={handleFile} className="hidden" />
        <button
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-white/10 px-3 py-2.5 text-xs font-semibold text-white transition-colors hover:bg-white/15 disabled:opacity-60"
        >
          {uploading ? (
            <>
              <Spinner /> Reading résumé…
            </>
          ) : (
            <>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 16V4M12 4l-4 4M12 4l4 4M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Upload résumé (PDF)
            </>
          )}
        </button>
        {uploadError && <p className="mt-2 text-[11px] leading-snug text-red-400">{uploadError}</p>}
      </div>
    </aside>
  )
}

function Spinner() {
  return (
    <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="3" opacity="0.25" />
      <path d="M21 12a9 9 0 00-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  )
}
