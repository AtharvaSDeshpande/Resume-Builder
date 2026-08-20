import React, { useState } from 'react'
import Modal from './ui/Modal.jsx'
import { TextInput, TextArea, ListField } from './ui/Field.jsx'

/**
 * Double-click editor for a single résumé section. It works on a local draft
 * and only commits via `onSave(sectionKey, draft)` when the user hits Save, so
 * the résumé and Firestore update together. The correct editor is chosen from
 * the section's restriction `type`.
 */
export default function EditSectionModal({ sectionKey, cfg, value, onSave, onClose }) {
  const [draft, setDraft] = useState(() => structuredClone(value ?? emptyFor(cfg, sectionKey)))
  const [saving, setSaving] = useState(false)

  const title = cfg.label || TITLES[sectionKey] || sectionKey
  const boldHint = 'Wrap text in **double asterisks** to make it bold.'

  async function handleSave() {
    setSaving(true)
    try {
      await onSave(sectionKey, draft)
      onClose()
    } finally {
      setSaving(false)
    }
  }

  const Editor = EDITORS[cfg.type] || (() => <p className="text-sm text-slate-500">This section isn’t editable.</p>)

  return (
    <Modal
      title={`Edit ${title}`}
      subtitle="Changes save to this résumé instantly."
      onClose={onClose}
      maxWidth={WIDE.has(cfg.type) ? 'max-w-2xl' : 'max-w-lg'}
      footer={
        <>
          <button
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-accent-dark disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save changes'}
          </button>
        </>
      }
    >
      <Editor cfg={cfg} draft={draft} setDraft={setDraft} boldHint={boldHint} />
    </Modal>
  )
}

const WIDE = new Set(['experience', 'projects', 'table'])

const TITLES = { header: 'Header & Name', footer: 'Footer' }

/* ------------------------------------------------------------------ editors */

function HeadlineEditor({ cfg, draft, setDraft, boldHint }) {
  return (
    <TextArea
      label="Profile summary"
      value={draft.summary}
      onChange={(summary) => setDraft({ ...draft, summary })}
      max={cfg.summary?.maxChars}
      rows={5}
      hint={boldHint}
    />
  )
}

function BulletsEditor({ cfg, draft, setDraft }) {
  return (
    <ListField
      label={cfg.label}
      items={draft}
      onChange={setDraft}
      maxItems={cfg.items?.max}
      minItems={cfg.items?.min}
      maxCharsPerItem={cfg.items?.maxCharsPerItem}
      addLabel="Add"
    />
  )
}

function ExperienceEditor({ cfg, draft, setDraft, boldHint, headingKey }) {
  const entries = draft || []
  const setEntry = (i, patch) => setDraft(entries.map((e, idx) => (idx === i ? { ...e, ...patch } : e)))
  const removeEntry = (i) => setDraft(entries.filter((_, idx) => idx !== i))
  const addEntry = () => setDraft([...entries, { [headingKey]: '', bullets: [''] }])
  const atMax = cfg.entries?.max != null && entries.length >= cfg.entries.max

  return (
    <div className="space-y-4">
      {entries.map((entry, i) => (
        <div key={i} className="rounded-xl border border-slate-200 p-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
              Entry {i + 1}
            </span>
            <button
              onClick={() => removeEntry(i)}
              disabled={cfg.entries?.min != null && entries.length <= cfg.entries.min}
              className="text-xs font-medium text-slate-400 hover:text-flag disabled:opacity-30"
            >
              Remove
            </button>
          </div>
          <div className="space-y-3">
            <TextInput
              label={headingKey === 'heading' ? 'Title | Company | Dates' : 'Project title'}
              value={entry[headingKey]}
              onChange={(v) => setEntry(i, { [headingKey]: v })}
              max={cfg.entry?.[headingKey === 'heading' ? 'heading' : 'title']?.maxChars}
            />
            <ListField
              label="Bullet points"
              items={entry.bullets}
              onChange={(bullets) => setEntry(i, { bullets })}
              maxItems={cfg.entry?.bullets?.max}
              minItems={cfg.entry?.bullets?.min}
              maxCharsPerItem={cfg.entry?.bullets?.maxCharsPerBullet}
              addLabel="Add bullet"
              hint={boldHint}
            />
          </div>
        </div>
      ))}
      <button
        onClick={addEntry}
        disabled={atMax}
        className="w-full rounded-lg border border-dashed border-slate-300 py-2 text-xs font-medium text-slate-600 hover:border-accent hover:text-accent disabled:opacity-40"
      >
        + Add entry
      </button>
    </div>
  )
}

function TableEditor({ cfg, draft, setDraft }) {
  const rows = draft || []
  const cols = [
    { key: 'degree', label: 'Degree', max: cfg.cell?.degree?.maxChars },
    { key: 'institute', label: 'Institute / University, City', max: cfg.cell?.institute?.maxChars },
    { key: 'score', label: '%/CGPA', max: cfg.cell?.score?.maxChars },
    { key: 'year', label: 'Year', max: cfg.cell?.year?.maxChars },
  ]
  const setCell = (i, key, v) => setDraft(rows.map((r, idx) => (idx === i ? { ...r, [key]: v } : r)))
  const removeRow = (i) => setDraft(rows.filter((_, idx) => idx !== i))
  const addRow = () => setDraft([...rows, { degree: '', institute: '', score: '', year: '' }])
  const atMax = cfg.rows?.max != null && rows.length >= cfg.rows.max

  return (
    <div className="space-y-3">
      {rows.map((row, i) => (
        <div key={i} className="rounded-xl border border-slate-200 p-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Row {i + 1}</span>
            <button
              onClick={() => removeRow(i)}
              disabled={cfg.rows?.min != null && rows.length <= cfg.rows.min}
              className="text-xs font-medium text-slate-400 hover:text-flag disabled:opacity-30"
            >
              Remove
            </button>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {cols.map((c) => (
              <TextInput
                key={c.key}
                label={c.label}
                value={row[c.key]}
                onChange={(v) => setCell(i, c.key, v)}
                max={c.max}
              />
            ))}
          </div>
        </div>
      ))}
      <button
        onClick={addRow}
        disabled={atMax}
        className="w-full rounded-lg border border-dashed border-slate-300 py-2 text-xs font-medium text-slate-600 hover:border-accent hover:text-accent disabled:opacity-40"
      >
        + Add row
      </button>
    </div>
  )
}

function HeaderEditor({ cfg, draft, setDraft }) {
  return (
    <div className="space-y-4">
      <TextInput
        label="Full name"
        value={draft.name}
        onChange={(name) => setDraft({ ...draft, name })}
        max={cfg.fields?.name?.maxChars}
      />
      <ListField
        label="Meta lines (top-left)"
        items={draft.meta}
        onChange={(meta) => setDraft({ ...draft, meta })}
        maxItems={cfg.fields?.meta?.maxLines}
        maxCharsPerItem={cfg.fields?.meta?.maxCharsPerLine}
        addLabel="Add line"
        hint="e.g. “Portfolio Link: https://…”"
      />
    </div>
  )
}

function FooterEditor({ cfg, draft, setDraft }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <TextInput
        label="Bottom-left"
        value={draft.left}
        onChange={(left) => setDraft({ ...draft, left })}
        max={cfg.fields?.left?.maxChars}
      />
      <TextInput
        label="Bottom-right"
        value={draft.right}
        onChange={(right) => setDraft({ ...draft, right })}
        max={cfg.fields?.right?.maxChars}
      />
    </div>
  )
}

const EDITORS = {
  headline: HeadlineEditor,
  bullets: BulletsEditor,
  experience: (p) => <ExperienceEditor {...p} headingKey="heading" />,
  projects: (p) => <ExperienceEditor {...p} headingKey="title" />,
  table: TableEditor,
  header: HeaderEditor,
  footer: FooterEditor,
}

/* Sensible empty scaffolds when a section is missing entirely. */
function emptyFor(cfg, sectionKey) {
  switch (cfg.type) {
    case 'headline':
      return { summary: '' }
    case 'bullets':
      return ['']
    case 'experience':
      return [{ heading: '', bullets: [''] }]
    case 'projects':
      return [{ title: '', bullets: [''] }]
    case 'table':
      return [{ degree: '', institute: '', score: '', year: '' }]
    case 'header':
      return { name: '', meta: [''], logo: { line1: 'GREAT', line2: 'LAKES', line3: 'CHENNAI' } }
    case 'footer':
      return { left: '', right: '' }
    default:
      return {}
  }
}
