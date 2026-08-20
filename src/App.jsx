import React, { useEffect, useMemo, useState } from 'react'
import Sidebar from './components/Sidebar.jsx'
import ResumeCanvas from './components/ResumeCanvas.jsx'
import ResumeStage from './components/ResumeStage.jsx'
import AuthBar from './components/AuthBar.jsx'
import CustomizePanel from './components/CustomizePanel.jsx'
import SignInScreen from './components/SignInScreen.jsx'
import EditSectionModal from './components/EditSectionModal.jsx'
import { useAuth } from './auth/AuthContext.jsx'
import restrictions from './data/restrictions.json'
import { validateProfile } from './utils/validation.js'
import { computeResumeDiff } from './utils/resumeDiff.js'
import {
  subscribeMyResumes,
  saveResume,
  deleteResume,
  updateResumeProfile,
} from './services/resumesRepo.js'
import { parseResumeFile } from './services/resumeImport.js'
import { extractResumeFromPdf } from './ai/extractResume.js'

export default function App() {
  const { ready, isAuthenticated, user } = useAuth()
  if (!ready) return <Splash />
  if (!isAuthenticated) return <SignInScreen />
  return <Workspace user={user} />
}

function Workspace({ user }) {
  const [resumes, setResumes] = useState([])
  const [loadingResumes, setLoadingResumes] = useState(true)
  const [resumesError, setResumesError] = useState(null)

  const [activeId, setActiveId] = useState(null)
  const [previewMode, setPreviewMode] = useState(true)
  const [customizeOpen, setCustomizeOpen] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [baseId, setBaseId] = useState(null)
  const [tailoredPreview, setTailoredPreview] = useState(null)
  const [editingSection, setEditingSection] = useState(null)
  const [diffMode, setDiffMode] = useState(true)

  // Show/hide the tailored preview; auto-enable the diff view when one appears.
  const showTailoredPreview = (profile) => {
    setTailoredPreview(profile)
    setDiffMode(Boolean(profile))
  }

  useEffect(() => {
    setLoadingResumes(true)
    return subscribeMyResumes(
      user.uid,
      (records) => {
        setResumes(records)
        setLoadingResumes(false)
      },
      (err) => {
        setResumesError(err.message || 'Failed to load résumés.')
        setLoadingResumes(false)
      }
    )
  }, [user.uid])

  useEffect(() => {
    if (resumes.length === 0) return setActiveId(null)
    if (!resumes.some((r) => r.id === activeId)) setActiveId(resumes[0].id)
  }, [resumes, activeId])

  useEffect(() => {
    if (!baseId || !resumes.some((r) => r.id === baseId)) setBaseId(activeId)
  }, [activeId, baseId, resumes])

  const activeRecord = resumes.find((r) => r.id === activeId) || null
  const shownProfile = tailoredPreview || activeRecord?.profile || null
  const editable = Boolean(activeRecord) && !tailoredPreview

  // Diff the tailored preview against the résumé it was tailored from.
  const baseForDiff = resumes.find((r) => r.id === baseId)?.profile || activeRecord?.profile || null
  const diff = useMemo(
    () => (tailoredPreview && baseForDiff ? computeResumeDiff(baseForDiff, tailoredPreview) : null),
    [tailoredPreview, baseForDiff]
  )
  const showDiff = diffMode && Boolean(tailoredPreview) && Boolean(diff)

  const validation = useMemo(
    () => (shownProfile ? validateProfile(shownProfile, restrictions) : { count: 0, flags: {}, list: [] }),
    [shownProfile]
  )
  const validationById = useMemo(() => {
    const map = {}
    for (const r of resumes) map[r.id] = validateProfile(r.profile, restrictions).count
    return map
  }, [resumes])

  function selectResume(id) {
    setActiveId(id)
    showTailoredPreview(null)
  }

  async function uploadResume(file) {
    const isPdf = /\.pdf$/i.test(file.name) || file.type === 'application/pdf'
    const profile = isPdf ? await extractResumeFromPdf(file) : await parseResumeFile(file)
    const id = await saveResume(user.uid, profile, 'uploaded')
    setActiveId(id)
    setDrawerOpen(false)
  }

  async function removeResume(record) {
    if (!window.confirm(`Delete "${record.name}"? This cannot be undone.`)) return
    await deleteResume(record.id)
  }

  async function saveSection(sectionKey, value) {
    if (!activeRecord) return
    const updated = { ...activeRecord.profile, [sectionKey]: value }
    await updateResumeProfile(activeRecord.id, updated)
  }

  const editingCfg = editingSection ? restrictions.sections[editingSection] : null

  return (
    <div className="workspace flex h-screen overflow-hidden">
      {/* Sidebar — static rail on desktop, slide-in drawer on mobile */}
      {drawerOpen && (
        <div className="app-overlay anim-fade fixed inset-0 z-40 bg-slate-900/50 md:hidden" onClick={() => setDrawerOpen(false)} />
      )}
      <div
        className={`z-40 h-full ${
          drawerOpen ? 'fixed inset-y-0 left-0 anim-slide-left shadow-2xl' : 'hidden'
        } md:static md:block md:shadow-none`}
      >
        <Sidebar
          resumes={resumes}
          activeId={activeId}
          onSelect={selectResume}
          onDelete={removeResume}
          onUpload={uploadResume}
          validationById={validationById}
          loading={loadingResumes}
          onNavigate={() => setDrawerOpen(false)}
        />
      </div>

      <main className="flex min-w-0 flex-1 flex-col">
        {/* Toolbar */}
        <header className="app-toolbar z-20 flex items-center justify-between gap-2 border-b border-slate-200 bg-white/90 px-3 py-2.5 backdrop-blur sm:px-5">
          <div className="flex min-w-0 items-center gap-2">
            <button
              onClick={() => setDrawerOpen(true)}
              className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-slate-600 hover:bg-slate-100 md:hidden"
              aria-label="Open menu"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M4 6h16M4 12h16M4 18h16" strokeLinecap="round" />
              </svg>
            </button>
            <div className="min-w-0">
              <h2 className="flex items-center gap-2 truncate text-sm font-bold text-slate-900">
                <span className="truncate">{activeRecord?.name || 'No résumé selected'}</span>
                {tailoredPreview && (
                  <span className="hidden shrink-0 rounded-full bg-accent/10 px-2 py-0.5 text-[10px] font-semibold text-accent sm:inline">
                    tailored preview
                  </span>
                )}
              </h2>
              {shownProfile && (
                <span className="flex items-center gap-2">
                  <span className={`text-[11px] font-medium ${validation.count > 0 ? 'text-flag' : 'text-emerald-600'}`}>
                    {validation.count > 0
                      ? `${validation.count} constraint issue${validation.count > 1 ? 's' : ''}`
                      : editable
                        ? 'All good · double-click a section to edit'
                        : 'All constraints satisfied'}
                  </span>
                  {validation.advisoryCount > 0 && (
                    <span
                      className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700"
                      title="GLIM writing suggestions"
                    >
                      {validation.advisoryCount} tip{validation.advisoryCount > 1 ? 's' : ''}
                    </span>
                  )}
                </span>
              )}
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-1.5 sm:gap-3">
            <label className="hidden cursor-pointer items-center gap-2 text-xs text-slate-600 lg:flex">
              <input
                type="checkbox"
                checked={previewMode}
                onChange={(e) => setPreviewMode(e.target.checked)}
                className="h-3.5 w-3.5 accent-accent"
              />
              Flags
            </label>
            <ToolButton
              onClick={() => setCustomizeOpen((v) => !v)}
              disabled={!activeRecord}
              primary={!customizeOpen}
              label={customizeOpen ? 'Close' : 'Tailor'}
              icon={<SparkIcon />}
            />
            <ToolButton onClick={() => window.print()} disabled={!shownProfile} label="Print" icon={<PrintIcon />} />
            <div className="ml-0.5 sm:ml-1">
              <AuthBar />
            </div>
          </div>
        </header>

        {/* Hard limit errors (screen only) */}
        {previewMode && validation.count > 0 && (
          <div className="validation-panel max-h-[110px] overflow-auto border-b border-flag/30 bg-flag/5 px-4 py-2 sm:px-5">
            <ul className="space-y-0.5 text-[11px] text-flag">
              {validation.list.map((v, i) => (
                <li key={i}>
                  <span className="font-semibold">{restrictions.sections[v.section]?.label || v.section}:</span> {v.message}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* GLIM writing suggestions — advisory, never blocking (screen only) */}
        {previewMode && validation.advisoryCount > 0 && (
          <div className="validation-panel max-h-[110px] overflow-auto border-b border-amber-300/50 bg-amber-50 px-4 py-2 sm:px-5">
            <div className="mb-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-600">
              GLIM writing tips
            </div>
            <ul className="space-y-0.5 text-[11px] text-amber-700">
              {validation.advisories.map((v, i) => (
                <li key={i}>
                  <span className="font-semibold">{restrictions.sections[v.section]?.label || v.section}:</span> {v.message}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* AI diff bar (screen only, appears with a tailored preview) */}
        {tailoredPreview && diff && (
          <DiffBar
            diff={diff}
            diffMode={diffMode}
            onToggle={() => setDiffMode((v) => !v)}
            sectionLabel={(s) => restrictions.sections[s]?.label || s}
          />
        )}

        {/* Canvas + optional customize panel */}
        <div className="flex min-h-0 flex-1">
          <div className="canvas-scroll flex-1">
            {shownProfile ? (
              <ResumeStage>
                <ResumeCanvas
                  profile={shownProfile}
                  restrictions={restrictions}
                  flags={validation.flags}
                  previewMode={previewMode}
                  editable={editable}
                  onEditSection={setEditingSection}
                  diffMode={showDiff}
                  diffMarks={diff?.marks || {}}
                />
              </ResumeStage>
            ) : (
              <EmptyState loading={loadingResumes} error={resumesError} onUpload={() => setDrawerOpen(true)} />
            )}
          </div>

          {customizeOpen && (
            <CustomizePanel
              uid={user.uid}
              resumes={resumes}
              baseId={baseId}
              onBaseChange={setBaseId}
              onPreview={showTailoredPreview}
              isPreviewing={Boolean(tailoredPreview)}
              onSaved={(id) => {
                showTailoredPreview(null)
                setActiveId(id)
              }}
              onClose={() => setCustomizeOpen(false)}
            />
          )}
        </div>
      </main>

      {editingSection && editingCfg && (
        <EditSectionModal
          sectionKey={editingSection}
          cfg={editingCfg}
          value={activeRecord?.profile?.[editingSection]}
          onSave={saveSection}
          onClose={() => setEditingSection(null)}
        />
      )}
    </div>
  )
}

function DiffBar({ diff, diffMode, onToggle, sectionLabel }) {
  const changedCount = Object.keys(diff.marks).length
  const removed = diff.removed || []

  return (
    <div className="no-print flex flex-wrap items-center gap-x-4 gap-y-1.5 border-b border-emerald-200/60 bg-emerald-50/70 px-4 py-2 sm:px-5">
      <span className="flex items-center gap-1.5 text-xs font-bold text-emerald-700">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2l1.9 5.1L19 9l-5.1 1.9L12 16l-1.9-5.1L5 9l5.1-1.9L12 2z" />
        </svg>
        AI changes
      </span>

      <button
        onClick={onToggle}
        className="flex items-center gap-1.5 text-[11px] font-medium text-emerald-700"
        aria-pressed={diffMode}
      >
        <span
          className={`relative h-3.5 w-6 rounded-full transition-colors ${diffMode ? 'bg-emerald-500' : 'bg-slate-300'}`}
        >
          <span
            className={`absolute top-0.5 h-2.5 w-2.5 rounded-full bg-white transition-all ${diffMode ? 'left-3' : 'left-0.5'}`}
          />
        </span>
        Highlights
      </button>

      <span className="flex items-center gap-3 text-[11px] text-slate-500">
        <span className="flex items-center gap-1">
          <span className="inline-block h-2.5 w-2.5 rounded-sm bg-emerald-400/70" /> added / updated
        </span>
        <span className="flex items-center gap-1">
          <span className="text-red-500 line-through">abc</span> removed
        </span>
      </span>

      <span className="text-[11px] text-slate-400">
        {changedCount} edit{changedCount === 1 ? '' : 's'}
        {removed.length > 0 && ` · ${removed.length} removed`}
      </span>

      {removed.length > 0 && (
        <span
          className="min-w-0 truncate text-[11px] text-slate-500"
          title={removed.map((r) => `${sectionLabel(r.section)}: ${r.text}`).join('\n')}
        >
          Removed: {removed.slice(0, 3).map((r) => r.text).join(' · ')}
          {removed.length > 3 ? ` +${removed.length - 3} more` : ''}
        </span>
      )}
    </div>
  )
}

function ToolButton({ onClick, disabled, primary, label, icon }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-semibold shadow-sm transition-colors disabled:opacity-40 sm:px-3.5 ${
        primary
          ? 'bg-accent text-white hover:bg-accent-dark'
          : 'border border-slate-200 text-slate-700 hover:bg-slate-50'
      }`}
    >
      {icon}
      <span className="hidden sm:inline">{label}</span>
    </button>
  )
}

function EmptyState({ loading, error, onUpload }) {
  return (
    <div className="flex h-full w-full items-center justify-center p-8">
      <div className="max-w-sm text-center">
        <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-white text-accent shadow-sm ring-1 ring-slate-100">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M14 3v5h5M8 13h8M8 17h6M8 9h2" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M6 3h8l5 5v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5a2 2 0 012-2z" strokeLinejoin="round" />
          </svg>
        </div>
        <h3 className="text-base font-bold text-slate-800">
          {error ? 'Something went wrong' : loading ? 'Loading your résumés…' : 'No résumé yet'}
        </h3>
        <p className="mt-1 text-sm text-slate-500">
          {error || (loading ? '' : 'Upload your résumé PDF and we’ll turn it into an editable, single-page résumé.')}
        </p>
        {!loading && !error && (
          <button
            onClick={onUpload}
            className="mt-5 rounded-xl bg-accent px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-accent-dark md:hidden"
          >
            Upload résumé
          </button>
        )}
      </div>
    </div>
  )
}

function Splash() {
  return (
    <div className="grid h-screen place-items-center bg-slate-950 text-slate-300">
      <div className="flex items-center gap-3 text-sm">
        <svg className="animate-spin" width="18" height="18" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="3" opacity="0.25" />
          <path d="M21 12a9 9 0 00-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
        </svg>
        Loading…
      </div>
    </div>
  )
}

function SparkIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2l1.9 5.1L19 9l-5.1 1.9L12 16l-1.9-5.1L5 9l5.1-1.9L12 2z" />
    </svg>
  )
}
function PrintIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M6 9V3h12v6M6 18H4a2 2 0 01-2-2v-4a2 2 0 012-2h16a2 2 0 012 2v4a2 2 0 01-2 2h-2M6 14h12v7H6z" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
