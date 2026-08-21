import React from 'react'
import Card from '../ui/Card.jsx'
import { Bullets, Chips, Prose, NumberedList, Sources } from './parts.jsx'

/** Structured render of the Company Intel agent's JSON. */
export default function CompanyIntelView({ data, sources, grounded }) {
  if (!data) return null
  return (
    <div className="space-y-4">
      {(data.oneLiner || data.overview) && (
        <Card>
          {data.oneLiner && <p className="text-base font-semibold text-slate-900">{data.oneLiner}</p>}
          {data.overview && <p className="mt-1.5 text-sm leading-relaxed text-slate-600">{data.overview}</p>}
          {data.businessModel && (
            <p className="mt-2 text-xs text-slate-500">
              <span className="font-semibold">Business model:</span> {data.businessModel}
            </p>
          )}
        </Card>
      )}

      {data.products?.length > 0 && (
        <Card title="Products & offerings">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {data.products.map((p, i) => (
              <div key={i} className="rounded-xl border border-slate-100 bg-slate-50/60 p-3">
                <div className="text-sm font-semibold text-slate-800">{p.name}</div>
                <div className="mt-0.5 text-xs leading-snug text-slate-500">{p.description}</div>
              </div>
            ))}
          </div>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {data.differentiators?.length > 0 && (
          <Card title="Differentiators">
            <Bullets items={data.differentiators} tone="accent" />
          </Card>
        )}
        {data.recentDevelopments?.length > 0 && (
          <Card title="Recent developments">
            <Bullets items={data.recentDevelopments} />
          </Card>
        )}
      </div>

      {data.roleRelevance?.length > 0 && (
        <Card title="Why this matters for your role">
          <Bullets items={data.roleRelevance} tone="accent" />
        </Card>
      )}

      {data.cultureAndValues?.length > 0 && (
        <Card title="Culture & values">
          <Chips items={data.cultureAndValues} tone="emerald" />
        </Card>
      )}

      {data.talkingPoints?.length > 0 && (
        <Card title="Interview talking points">
          <NumberedList items={data.talkingPoints} />
        </Card>
      )}

      {data.questionsToAsk?.length > 0 && (
        <Card title="Smart questions to ask them">
          <Bullets items={data.questionsToAsk} tone="accent" />
        </Card>
      )}

      <Card bodyClassName="px-4 pb-3 pt-0 sm:px-5">
        <Sources sources={sources} grounded={grounded} />
      </Card>
    </div>
  )
}
