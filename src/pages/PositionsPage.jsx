import React, { useState } from 'react'
import { useData } from '../data/AppData.jsx'
import PageHeader from '../components/PageHeader.jsx'
import Button from '../components/ui/Button.jsx'
import EmptyState from '../components/EmptyState.jsx'
import PositionCard from '../components/positions/PositionCard.jsx'
import NewPositionModal from '../components/positions/NewPositionModal.jsx'

/** Home: the user's job positions. Step 1 (create a position) starts here. */
export default function PositionsPage() {
  const { positions, positionsLoading, createPosition, deletePosition } = useData()
  const [creating, setCreating] = useState(false)

  async function remove(p) {
    if (!window.confirm(`Delete the position at "${p.company}"? This cannot be undone.`)) return
    await deletePosition(p.id)
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
      <PageHeader
        title="Positions"
        subtitle="A workspace per role — tailor your résumé and track your fit."
        action={
          <Button icon={<PlusIcon />} onClick={() => setCreating(true)}>
            New Position
          </Button>
        }
      />

      {positionsLoading && positions.length === 0 && <p className="text-sm text-slate-400">Loading…</p>}

      {!positionsLoading && positions.length === 0 ? (
        <EmptyState
          icon="briefcase"
          title="No positions yet"
          message="Create a job position with the company and job description, then tailor your résumé to it."
          action={
            <Button icon={<PlusIcon />} onClick={() => setCreating(true)}>
              Create your first position
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {positions.map((p) => (
            <PositionCard key={p.id} position={p} onDelete={remove} />
          ))}
        </div>
      )}

      {creating && <NewPositionModal onCreate={createPosition} onClose={() => setCreating(false)} />}
    </div>
  )
}

function PlusIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
      <path d="M12 5v14M5 12h14" strokeLinecap="round" />
    </svg>
  )
}
