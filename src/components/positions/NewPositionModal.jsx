import React, { useState } from 'react'
import Modal from '../ui/Modal.jsx'
import { TextInput, TextArea } from '../ui/Field.jsx'

/** Step 1 of the workflow: create a job position (company, JD, interview date). */
export default function NewPositionModal({ onCreate, onClose }) {
  const [company, setCompany] = useState('')
  const [jobDescription, setJobDescription] = useState('')
  const [interviewDate, setInterviewDate] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  const canSave = company.trim() && jobDescription.trim().length > 20 && !saving

  async function handleSave() {
    setSaving(true)
    setError(null)
    try {
      await onCreate({ company: company.trim(), jobDescription: jobDescription.trim(), interviewDate })
      onClose()
    } catch (err) {
      setError(err.message || 'Could not create the position.')
      setSaving(false)
    }
  }

  return (
    <Modal
      title="New job position"
      subtitle="Add the role you're targeting — you'll tailor your résumé to it next."
      onClose={onClose}
      footer={
        <>
          <button onClick={onClose} className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!canSave}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-accent-dark disabled:opacity-50"
          >
            {saving ? 'Creating…' : 'Create position'}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <TextInput label="Company" value={company} onChange={setCompany} placeholder="e.g. Acme Corp" />
        <TextArea
          label="Job description"
          value={jobDescription}
          onChange={setJobDescription}
          rows={7}
          placeholder="Paste the full job description here…"
          hint="Used to tailor your résumé and compute the JD-fit score."
        />
        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-slate-600">
            Tentative interview date <span className="font-normal text-slate-400">(optional)</span>
          </span>
          <input
            type="date"
            value={interviewDate}
            onChange={(e) => setInterviewDate(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
          />
        </label>
        {error && <p className="text-xs text-red-600">{error}</p>}
      </div>
    </Modal>
  )
}
