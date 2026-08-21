import React, { useMemo, useState } from 'react'
import { Routes, Route, NavLink, Link, useParams, useNavigate } from 'react-router-dom'
import { useData } from '../data/AppData.jsx'
import { customizeResume } from '../ai/customizeResume.js'
import { agentApi } from '../services/agentApi.js'
import restrictions from '../data/restrictions.json'
import { validateProfile } from '../utils/validation.js'
import { computeResumeDiff } from '../utils/resumeDiff.js'
import { formatDate, relativeDay } from '../utils/format.js'
import ResumeCanvas from '../components/ResumeCanvas.jsx'
import ResumeStage from '../components/ResumeStage.jsx'
import EditSectionModal from '../components/EditSectionModal.jsx'
import ProgressPanel from '../components/ui/ProgressPanel.jsx'
import Button from '../components/ui/Button.jsx'
import Card from '../components/ui/Card.jsx'
import { StatusBadge, StatusButtons } from '../components/positions/PositionStatus.jsx'
import { ScoreChip } from '../components/positions/ScoreChip.jsx'
import FeedbackView from '../components/positions/FeedbackView.jsx'
import AgentTab from '../components/agents/AgentTab.jsx'
import { AGENT_TABS } from '../agents/registry.jsx'

/** Base tabs; the career-prep agent tabs are appended once a résumé is tailored. */
const BASE_TABS = [
  { key: 'overview', label: 'Overview', path: '', end: true },
  { key: 'resume', label: 'Résumé', path: 'resume' },
  { key: 'feedback', label: 'Feedback', path: 'feedback' },
]

export default function PositionDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { positions, positionsLoading, masterResumes, setStatus, saveTailoring, saveScore, updatePosition } = useData()
  const position = positions.find((p) => p.id === id)

  // Tailoring state lives here (shared across tabs) so a run in progress reflects
  // everywhere and the Résumé/Feedback tabs only render once it's complete.
  const [tailoring, setTailoring] = useState({ running: false, progress: null, error: null })

  if (positionsLoading && !position) return <Centered>Loading…</Centered>
  if (!position)
    return (
      <Centered>
        <p className="text-slate-500">Position not found.</p>
        <Link to="/positions" className="mt-2 text-sm font-semibold text-accent hover:underline">
          ← Back to positions
        </Link>
      </Centered>
    )

  async function runTailor(base) {
    setTailoring({ running: true, progress: { label: 'Starting…' }, error: null })
    try {
      const res = await customizeResume({
        baseResume: base.profile,
        jobDescription: position.jobDescription,
        onProgress: (p) => setTailoring((s) => ({ ...s, progress: p })),
      })
      await saveTailoring(position.id, {
        baseResumeId: base.id,
        tailored: {
          profile: res.profile,
          changeLog: res.changeLog || [],
          corrections: res.corrections || [],
          model: res.model,
          promptVersion: res.promptVersion,
        },
        feedback: {
          score: res.score ?? null,
          jdCoverage: res.jdCoverage || { covered: [], missing: [] },
          weaknesses: res.weaknesses || [],
          requirements: res.requirements || {},
          company: res.company || position.company,
        },
      })
      setTailoring({ running: false, progress: null, error: null })
      navigate('resume')
    } catch (err) {
      setTailoring({ running: false, progress: null, error: err.message || 'Tailoring failed.' })
    }
  }

  // Edits to the tailored résumé write straight back to the position, so the
  // "Re-check score" always scores the latest (manually-edited) résumé.
  async function editResumeSection(sectionKey, value) {
    if (!position.tailored) return
    const nextProfile = { ...position.tailored.profile, [sectionKey]: value }
    await updatePosition(position.id, { tailored: { ...position.tailored, profile: nextProfile } })
  }

  async function recheckScore() {
    const profile = position.tailored?.profile
    if (!profile) return
    const res = await agentApi.score({ profile, jobDescription: position.jobDescription })
    await saveScore(position.id, {
      ...(position.feedback || {}),
      score: res.score,
      jdCoverage: res.jdCoverage,
      weaknesses: res.weaknesses,
    })
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
      <Link to="/positions" className="mb-3 inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-800">
        ← Positions
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="truncate text-xl font-bold tracking-tight text-slate-900">{position.company}</h1>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
            <StatusBadge status={position.status} />
            {position.interviewDate && (
              <span>
                Interview {formatDate(position.interviewDate)} · {relativeDay(position.interviewDate)}
              </span>
            )}
          </div>
        </div>
        {typeof position.feedback?.score === 'number' && !tailoring.running && <ScoreChip score={position.feedback.score} />}
      </div>

      {tailoring.running && (
        <div className="mt-4">
          <ProgressPanel progress={tailoring.progress} />
        </div>
      )}
      {tailoring.error && !tailoring.running && (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-2.5 text-xs text-red-700">{tailoring.error}</div>
      )}

      {/* Tabs — agent tabs appear once a résumé is tailored */}
      <div className="mt-5 flex gap-1 overflow-x-auto border-b border-slate-200">
        {[...BASE_TABS, ...(position.tailored ? AGENT_TABS.map((a) => ({ key: a.id, label: a.label, path: a.path })) : [])].map((t) => (
          <NavLink
            key={t.key}
            to={t.path}
            end={t.end}
            className={({ isActive }) =>
              `-mb-px shrink-0 border-b-2 px-3 py-2 text-sm font-semibold transition-colors ${
                isActive ? 'border-accent text-accent' : 'border-transparent text-slate-500 hover:text-slate-800'
              }`
            }
          >
            {t.label}
          </NavLink>
        ))}
      </div>

      <div className="pt-5">
        <Routes>
          <Route
            index
            element={
              <OverviewTab
                position={position}
                masterResumes={masterResumes}
                tailoring={tailoring}
                onRun={runTailor}
                onStatus={(s) => setStatus(position.id, s)}
                onGoTo={navigate}
              />
            }
          />
          <Route path="resume" element={<ResumeTab position={position} tailoring={tailoring} onEditSection={editResumeSection} />} />
          <Route path="feedback" element={<FeedbackTab position={position} tailoring={tailoring} onRecheck={recheckScore} />} />
          {position.tailored &&
            AGENT_TABS.map((a) => (
              <Route key={a.id} path={a.path} element={<AgentTab position={position} agentDef={a} />} />
            ))}
        </Routes>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ tabs */

function OverviewTab({ position, masterResumes, tailoring, onRun, onStatus, onGoTo }) {
  const [baseId, setBaseId] = useState(masterResumes[0]?.id || '')
  const base = masterResumes.find((r) => r.id === baseId) || masterResumes[0]

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
      <div className="space-y-5 lg:col-span-3">
        <Card title="Application status">
          <StatusButtons status={position.status} onChange={onStatus} />
          <p className="mt-3 text-[11px] text-slate-400">
            Move this along as you hear back — see everything on the Applications page.
          </p>
        </Card>

        <Card title="Job description">
          <p className="max-h-80 overflow-auto whitespace-pre-wrap text-sm leading-relaxed text-slate-600">
            {position.jobDescription}
          </p>
        </Card>
      </div>

      <div className="lg:col-span-2">
        <Card title="Tailor & get feedback">
          {masterResumes.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 p-4 text-center text-sm text-slate-500">
              Add a base résumé first.{' '}
              <Link to="/resumes" className="font-semibold text-accent hover:underline">
                Upload one →
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {position.tailored && !tailoring.running && (
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="subtle" onClick={() => onGoTo('resume')}>
                    View résumé
                  </Button>
                  <Button size="sm" variant="secondary" onClick={() => onGoTo('feedback')}>
                    View feedback
                  </Button>
                </div>
              )}
              <label className="block">
                <span className="mb-1 block text-xs font-semibold text-slate-600">Base résumé to tailor</span>
                <select
                  value={base?.id}
                  onChange={(e) => setBaseId(e.target.value)}
                  disabled={tailoring.running}
                  className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-sm focus:border-accent focus:ring-2 focus:ring-accent/20"
                >
                  {masterResumes.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
              </label>
              <Button className="w-full" disabled={tailoring.running || !base} onClick={() => onRun(base)}>
                {tailoring.running ? 'Tailoring…' : position.tailored ? 'Re-tailor & get feedback' : 'Tailor & Get Feedback'}
              </Button>
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}

function ResumeTab({ position, tailoring, onEditSection }) {
  const { masterResumes } = useData()
  const [diffMode, setDiffMode] = useState(true)
  const [editing, setEditing] = useState(null)
  const tailored = position.tailored?.profile

  const base = masterResumes.find((r) => r.id === position.baseResumeId)?.profile || null
  const validation = useMemo(() => (tailored ? validateProfile(tailored, restrictions) : null), [tailored])
  const diff = useMemo(() => (tailored && base ? computeResumeDiff(base, tailored) : null), [tailored, base])

  if (tailoring.running) return <TailoringPlaceholder label="Building your tailored résumé…" />
  if (!tailored)
    return (
      <Card title="No tailored résumé yet">
        <p className="text-sm text-slate-500">
          Tailor a résumé from the{' '}
          <Link to="" className="font-semibold text-accent hover:underline">
            Overview
          </Link>{' '}
          tab and it'll appear here.
        </p>
      </Card>
    )

  const editCfg = editing ? restrictions.sections[editing] : null

  return (
    <div>
      <div className="no-print mb-3 flex flex-wrap items-center gap-2">
        {diff && (
          <Button size="sm" variant="secondary" onClick={() => setDiffMode((v) => !v)}>
            {diffMode ? 'Hide changes' : 'Show changes'}
          </Button>
        )}
        <Button size="sm" variant="secondary" onClick={() => window.print()}>
          Print / Save PDF
        </Button>
        <span className="text-[11px] text-slate-400">Double-click a section to edit.</span>
        {diffMode && diff && (
          <span className="ml-auto text-[11px] text-slate-400">
            <span className="mr-1 inline-block h-2.5 w-2.5 rounded-sm bg-emerald-400/70 align-middle" />
            added · <span className="text-red-500 line-through">strike</span> = removed
          </span>
        )}
      </div>

      <div className="canvas-scroll rounded-2xl bg-slate-100 p-4">
        <ResumeStage>
          <ResumeCanvas
            profile={tailored}
            restrictions={restrictions}
            flags={validation.flags}
            previewMode
            editable
            onEditSection={setEditing}
            diffMode={diffMode && Boolean(diff)}
            diffMarks={diff?.marks || {}}
          />
        </ResumeStage>
      </div>

      {editing && editCfg && (
        <EditSectionModal
          sectionKey={editing}
          cfg={editCfg}
          value={tailored[editing]}
          onSave={onEditSection}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  )
}

function FeedbackTab({ position, tailoring, onRecheck }) {
  const [rechecking, setRechecking] = useState(false)
  const [error, setError] = useState(null)

  if (tailoring.running) return <TailoringPlaceholder label="Scoring your résumé against the role…" />

  async function recheck() {
    setRechecking(true)
    setError(null)
    try {
      await onRecheck()
    } catch (err) {
      setError(err.message || 'Could not re-check the score.')
    } finally {
      setRechecking(false)
    }
  }

  return (
    <div className="max-w-3xl space-y-4">
      {position.tailored && (
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-slate-500">Reflects your latest résumé, including manual edits.</p>
          <Button size="sm" variant="secondary" disabled={rechecking} onClick={recheck}>
            {rechecking ? 'Re-checking…' : 'Re-check score'}
          </Button>
        </div>
      )}
      {error && <p className="text-xs text-red-600">{error}</p>}
      <FeedbackView
        feedback={position.feedback}
        changeLog={position.tailored?.changeLog}
        corrections={position.tailored?.corrections}
      />
    </div>
  )
}

/* ----------------------------------------------------------------- helpers */

function TailoringPlaceholder({ label }) {
  return (
    <Card>
      <div className="flex items-center justify-center gap-3 py-10 text-sm text-slate-500">
        <svg className="animate-spin text-accent" width="18" height="18" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="3" opacity="0.25" />
          <path d="M21 12a9 9 0 00-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
        </svg>
        {label} This tab will fill in once it's done.
      </div>
    </Card>
  )
}

function Centered({ children }) {
  return <div className="flex flex-col items-center justify-center px-6 py-20 text-center">{children}</div>
}
