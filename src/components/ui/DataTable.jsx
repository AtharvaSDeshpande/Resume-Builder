import React from 'react'

/**
 * A clean, professional data table. Column-config driven so any list view can
 * reuse it (Applications now; future dashboards later).
 *
 * columns: [{ key, header, render?(row), align?: 'left'|'right'|'center', className?, headerClassName? }]
 */
export default function DataTable({ columns, rows, rowKey, onRowClick, empty }) {
  if (!rows?.length) {
    return <div className="rounded-2xl border border-slate-200 bg-white px-6 py-14 text-center text-sm text-slate-400">{empty}</div>
  }

  const alignClass = (a) => (a === 'right' ? 'text-right' : a === 'center' ? 'text-center' : 'text-left')

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50/70">
              {columns.map((c) => (
                <th
                  key={c.key}
                  className={`px-4 py-2.5 text-[11px] font-bold uppercase tracking-wide text-slate-500 ${alignClass(c.align)} ${c.headerClassName || ''}`}
                >
                  {c.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={rowKey(row)}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                className={`border-b border-slate-100 last:border-0 transition-colors ${
                  onRowClick ? 'cursor-pointer hover:bg-slate-50' : ''
                }`}
              >
                {columns.map((c) => (
                  <td key={c.key} className={`px-4 py-3 align-middle ${alignClass(c.align)} ${c.className || ''}`}>
                    {c.render ? c.render(row) : row[c.key]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
