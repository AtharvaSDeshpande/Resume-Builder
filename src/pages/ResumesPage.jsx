import React, { useMemo, useRef, useState } from 'react'
import { useData } from '../data/AppData.jsx'
import { updateResumeProfile } from '../services/resumesRepo.js'
import restrictions from '../data/restrictions.json'
import { validateProfile } from '../utils/validation.js'
import PageHeader from '../components/PageHeader.jsx'
import Button from '../components/ui/Button.jsx'
import Card from '../components/ui/Card.jsx'
import EmptyState from '../components/EmptyState.jsx'
import ResumeStage from '../components/ResumeStage.jsx'
import ResumeCanvas from '../components/ResumeCanvas.jsx'
import EditSectionModal from '../components/EditSectionModal.jsx'
import { Spinner } from '../components/ui/ProgressPanel.jsx'

/** My Résumés — the user's uploaded master résumés (upload once, reuse). */
export default function ResumesPage() {
  const { masterResumes, resumesLoading, uploadResume, deleteResume } = useData()
  const [selectedId, setSelectedId] = useState(null)

  const selected = masterResumes.find((r) => r.id === selectedId) || null
  if (selected) return <ResumePreview record={selected} onBack={() => setSelectedId(null)} />

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
      <PageHeader
        title="My Résumés"
        subtitle="Your uploaded master résumés — tailor these to any job position."
        action={<UploadButton onUpload={uploadResume} />}
      />

      {resumesLoading && masterResumes.length === 0 && <p className="text-sm text-slate-400">Loading…</p>}

      {!resumesLoading && masterResumes.length === 0 ? (
        <EmptyState
          icon="doc"
          title="No résumés yet"
          message="Upload your résumé PDF and we'll turn it into an editable, single-page résumé you can reuse across positions."
          action={<UploadButton onUpload={uploadResume} />}
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {masterResumes.map((r) => (
            <ResumeCardItem key={r.id} record={r} onOpen={() => setSelectedId(r.id)} onDelete={() => confirmDelete(r, deleteResume)} />
          ))}
        </div>
      )}
    </div>
  )
}

function confirmDelete(r, deleteResume) {
  if (window.confirm(`Delete "${r.name}"? This cannot be undone.`)) deleteResume(r.id)
}

function ResumeCardItem({ record, onOpen, onDelete }) {
  const issues = useMemo(() => validateProfile(record.profile, restrictions).count, [record.profile])
  return (
    <Card bodyClassName="p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="truncate text-sm font-bold text-slate-800">{record.name}</h3>
          <p className="mt-0.5 text-xs text-slate-400">{record.profile?.header?.name || 'Uploaded résumé'}</p>
        </div>
        {issues > 0 && (
          <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700" title={`${issues} constraint issue(s)`}>
            {issues}
          </span>
        )}
      </div>
      <div className="mt-4 flex items-center gap-2">
        <Button size="sm" variant="subtle" className="flex-1" onClick={onOpen}>
          Open & edit
        </Button>
        <Button size="sm" variant="danger" onClick={onDelete}>
          Delete
        </Button>
      </div>
    </Card>
  )
}

function ResumePreview({ record, onBack }) {
  const [editing, setEditing] = useState(null)
  const validation = useMemo(() => validateProfile(record.profile, restrictions), [record.profile])
  const editCfg = editing ? restrictions.sections[editing] : null

  async function save(sectionKey, value) {
    await updateResumeProfile(record.id, { ...record.profile, [sectionKey]: value })
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
      <button onClick={onBack} className="mb-3 inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-800">
        ← All résumés
      </button>
      <div className="no-print mb-3 flex flex-wrap items-center gap-2">
        <h1 className="text-lg font-bold text-slate-900">{record.name}</h1>
        <Button size="sm" variant="secondary" className="ml-auto" onClick={() => window.print()}>
          Print / Save PDF
        </Button>
        <span className="text-[11px] text-slate-400">Double-click or double-tap a section to edit.</span>
      </div>

      <div className="canvas-scroll rounded-2xl bg-slate-100 p-4">
        <ResumeStage>
          <ResumeCanvas
            profile={record.profile}
            restrictions={restrictions}
            flags={validation.flags}
            previewMode
            editable
            onEditSection={setEditing}
          />
        </ResumeStage>
      </div>

      {editing && editCfg && (
        <EditSectionModal sectionKey={editing} cfg={editCfg} value={record.profile[editing]} onSave={save} onClose={() => setEditing(null)} />
      )}
    </div>
  )
}

function UploadButton({ onUpload }) {
  const ref = useRef(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  async function handle(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setError(null)
    setBusy(true)
    try {
      await onUpload(file)
    } catch (err) {
      setError(err.message || 'Could not read that résumé.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="text-right">
      <input ref={ref} type="file" accept=".pdf,application/pdf,.json,application/json" onChange={handle} className="hidden" />
      <Button icon={busy ? <Spinner className="text-white" size={14} /> : <UploadIcon />} disabled={busy} onClick={() => ref.current?.click()}>
        {busy ? 'Reading…' : 'Upload résumé'}
      </Button>
      {error && <p className="mt-1 text-[11px] text-red-600">{error}</p>}
    </div>
  )
}

function UploadIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 16V4M12 4l-4 4M12 4l4 4M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
