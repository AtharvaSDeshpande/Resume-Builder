import React, { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useData } from '../data/AppData.jsx'
import { STATUS, STATUS_ORDER, statusLabel } from '../domain/status.js'
import { formatDate } from '../utils/format.js'
import PageHeader from '../components/PageHeader.jsx'
import DataTable from '../components/ui/DataTable.jsx'
import { StatusSelect } from '../components/positions/PositionStatus.jsx'
import { ScoreChip } from '../components/positions/ScoreChip.jsx'

/** All job positions as a sortable, filterable, professional table. */
export default function ApplicationsPage() {
  const { positions, positionsLoading, setStatus } = useData()
  const navigate = useNavigate()
  const [filter, setFilter] = useState('all')

  const counts = useMemo(() => {
    const c = { all: positions.length }
    for (const s of STATUS_ORDER) c[s] = 0
    for (const p of positions) c[p.status] = (c[p.status] || 0) + 1
    return c
  }, [positions])

  const rows = useMemo(
    () => (filter === 'all' ? positions : positions.filter((p) => p.status === filter)),
    [positions, filter]
  )

  const columns = [
    {
      key: 'company',
      header: 'Company',
      render: (r) => (
        <div className="min-w-0">
          <div className="truncate font-semibold text-slate-800">{r.company || 'Untitled'}</div>
          <div className="truncate text-[11px] text-slate-400">{firstLine(r.jobDescription)}</div>
        </div>
      ),
    },
    { key: 'interviewDate', header: 'Interview', render: (r) => <span className="text-slate-600">{r.interviewDate ? formatDate(r.interviewDate) : '—'}</span> },
    {
      key: 'score',
      header: 'Fit',
      align: 'center',
      render: (r) => (typeof r.feedback?.score === 'number' ? <ScoreChip score={r.feedback.score} /> : <span className="text-slate-300">—</span>),
    },
    {
      key: 'status',
      header: 'Status',
      render: (r) => <StatusSelect status={r.status} onChange={(s) => setStatus(r.id, s)} />,
    },
    { key: 'updated', header: 'Updated', align: 'right', render: (r) => <span className="text-[11px] text-slate-400">{r.updatedAtMs ? formatDate(r.updatedAtMs) : ''}</span> },
  ]

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
      <PageHeader title="Applications" subtitle="Every role you're tracking, in one place." />

      <div className="mb-4 flex flex-wrap gap-1.5">
        <FilterChip label="All" count={counts.all} active={filter === 'all'} onClick={() => setFilter('all')} />
        {STATUS_ORDER.map((s) => (
          <FilterChip
            key={s}
            label={STATUS[s].label}
            count={counts[s]}
            active={filter === s}
            onClick={() => setFilter(s)}
          />
        ))}
      </div>

      {(() => {
        const empty =
          positionsLoading
            ? 'Loading…'
            : filter === 'all'
              ? 'No positions yet — create one from the Positions page.'
              : `No ${statusLabel(filter).toLowerCase()} applications.`
        return (
          <>
            {/* Table on tablet/desktop; stacked cards on phones (no side-scroll). */}
            <div className="hidden sm:block">
              <DataTable columns={columns} rows={rows} rowKey={(r) => r.id} onRowClick={(r) => navigate(`/positions/${r.id}`)} empty={empty} />
            </div>
            <div className="space-y-2.5 sm:hidden">
              {rows.length === 0 ? (
                <div className="rounded-2xl border border-slate-200 bg-white px-6 py-12 text-center text-sm text-slate-400">{empty}</div>
              ) : (
                rows.map((r) => <ApplicationCard key={r.id} row={r} onOpen={() => navigate(`/positions/${r.id}`)} onStatus={(s) => setStatus(r.id, s)} />)
              )}
            </div>
          </>
        )
      })()}
    </div>
  )
}

/** Compact, tappable application row for phones. */
function ApplicationCard({ row, onOpen, onStatus }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-3.5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <button onClick={onOpen} className="min-w-0 flex-1 text-left">
          <div className="truncate font-semibold text-slate-800">{row.company || 'Untitled'}</div>
          <div className="truncate text-[11px] text-slate-400">{firstLine(row.jobDescription)}</div>
        </button>
        {typeof row.feedback?.score === 'number' && <ScoreChip score={row.feedback.score} />}
      </div>
      <div className="mt-3 flex items-center justify-between gap-2">
        <span className="text-[11px] text-slate-400">
          {row.interviewDate ? `Interview ${formatDate(row.interviewDate)}` : 'No interview date'}
        </span>
        <div onClick={(e) => e.stopPropagation()}>
          <StatusSelect status={row.status} onChange={onStatus} />
        </div>
      </div>
    </div>
  )
}

function FilterChip({ label, count, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
        active ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50'
      }`}
    >
      {label}
      <span className={`rounded-full px-1.5 text-[10px] ${active ? 'bg-white/20' : 'bg-slate-100 text-slate-500'}`}>{count}</span>
    </button>
  )
}

const firstLine = (t) => (t || '').split('\n')[0].slice(0, 80)
