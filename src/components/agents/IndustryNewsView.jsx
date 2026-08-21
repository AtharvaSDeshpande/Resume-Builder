import React from 'react'
import Card from '../ui/Card.jsx'
import { Bullets, Chips, Sources } from './parts.jsx'
import { formatDate } from '../../utils/format.js'

/** Structured render of the Industry News agent's JSON. */
export default function IndustryNewsView({ data, sources, grounded }) {
  if (!data) return null
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <span className="text-sm font-semibold text-slate-800">{data.industry || 'Industry'} · recent developments</span>
          {data.asOf && <span className="ml-2 text-xs text-slate-400">as of {formatDate(data.asOf)}</span>}
        </div>
      </div>

      {data.articles?.length > 0 ? (
        <div className="space-y-3">
          {data.articles.map((a, i) => (
            <Card key={i} bodyClassName="p-4">
              <div className="flex items-start justify-between gap-3">
                <h4 className="text-sm font-bold text-slate-900">{a.headline}</h4>
                {a.date && <span className="shrink-0 text-[11px] text-slate-400">{formatDate(a.date)}</span>}
              </div>
              {a.summary && <p className="mt-1.5 text-sm leading-relaxed text-slate-600">{a.summary}</p>}
              {a.impact && (
                <div className="mt-2 rounded-lg bg-amber-50 p-2.5 text-xs leading-snug text-amber-800">
                  <span className="font-semibold">Impact:</span> {a.impact}
                </div>
              )}
              {(a.url || a.source) && (
                <div className="mt-2 flex items-center gap-2 text-[11px] text-slate-400">
                  {a.source && <span>{a.source}</span>}
                  {a.url && (
                    <a href={a.url} target="_blank" rel="noreferrer" className="font-medium text-accent hover:underline">
                      Read →
                    </a>
                  )}
                </div>
              )}
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <p className="text-sm text-slate-500">No recent developments were returned.</p>
        </Card>
      )}

      {data.themes?.length > 0 && (
        <Card title="Key themes">
          <Chips items={data.themes} tone="accent" />
        </Card>
      )}

      {data.interviewAngles?.length > 0 && (
        <Card title="How to use this in your interview">
          <Bullets items={data.interviewAngles} tone="accent" />
        </Card>
      )}

      <Card bodyClassName="px-4 pb-3 pt-0 sm:px-5">
        <Sources sources={sources} grounded={grounded} />
      </Card>
    </div>
  )
}
