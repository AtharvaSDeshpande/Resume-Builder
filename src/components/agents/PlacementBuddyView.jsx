import React from 'react'
import Card from '../ui/Card.jsx'
import { Bullets, Chips, Prose, Sources } from './parts.jsx'

/** Structured render of the Placement Buddy agent's JSON. */
export default function PlacementBuddyView({ data, sources, grounded, steps }) {
  if (!data) return null
  return (
    <div className="space-y-4">
      {steps?.length > 0 && (
        <details className="rounded-xl border border-slate-100 bg-slate-50/60 px-3 py-2">
          <summary className="cursor-pointer text-[11px] font-bold uppercase tracking-wide text-slate-400">
            Agent activity · {steps.length} step{steps.length > 1 ? 's' : ''}
          </summary>
          <ol className="mt-2 space-y-1">
            {steps.map((s, i) => (
              <li key={i} className="flex gap-2 text-xs text-slate-500">
                <span className="font-mono text-[10px] text-accent">{s.tool}</span>
                <span className="text-slate-500">{s.summary || JSON.stringify(s.args)}</span>
              </li>
            ))}
          </ol>
        </details>
      )}

      {(data.roleFraming || data.verdict) && (
        <Card>
          {data.roleFraming && <Prose>{data.roleFraming}</Prose>}
          {data.verdict && (
            <div className="mt-3 rounded-xl border border-accent/20 bg-accent/5 p-3">
              <div className="text-[11px] font-bold uppercase tracking-wide text-accent">Honest read</div>
              <p className="mt-1 text-sm leading-relaxed text-slate-700">{data.verdict}</p>
            </div>
          )}
        </Card>
      )}

      {data.mustKnow?.length > 0 && (
        <Card title="What you must know">
          <Chips items={data.mustKnow} tone="accent" />
        </Card>
      )}

      {data.roadmap?.length > 0 && (
        <Card title="Preparation roadmap">
          <ol className="space-y-3">
            {data.roadmap.map((r, i) => (
              <li key={i} className="relative rounded-xl border border-slate-100 bg-slate-50/60 p-3 pl-4">
                <span className="absolute left-0 top-3 h-[calc(100%-1.5rem)] w-1 rounded-full bg-accent/40" />
                <div className="flex items-baseline gap-2">
                  <span className="text-[11px] font-bold uppercase tracking-wide text-accent">{r.phase}</span>
                  <span className="text-sm font-semibold text-slate-800">{r.goal}</span>
                </div>
                {r.topics?.length > 0 && (
                  <div className="mt-2">
                    <Chips items={r.topics} />
                  </div>
                )}
                {r.resources?.length > 0 && (
                  <p className="mt-2 text-xs text-slate-500">
                    <span className="font-semibold">Resources:</span> {r.resources.join(' · ')}
                  </p>
                )}
              </li>
            ))}
          </ol>
        </Card>
      )}

      {data.projectIdeas?.length > 0 && (
        <Card title="Projects to add to your résumé">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {data.projectIdeas.map((p, i) => (
              <div key={i} className="rounded-xl border border-slate-100 p-3">
                <div className="text-sm font-semibold text-slate-800">{p.title}</div>
                <div className="mt-0.5 text-xs leading-snug text-slate-500">{p.description}</div>
                {p.skills?.length > 0 && (
                  <div className="mt-2">
                    <Chips items={p.skills} tone="emerald" />
                  </div>
                )}
                {p.resumeBullet && (
                  <p className="mt-2 rounded-md bg-slate-50 p-2 text-[11px] italic text-slate-600">“{p.resumeBullet}”</p>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}

      {data.resumeAdvice?.length > 0 && (
        <Card title="Personalised résumé changes">
          <ul className="space-y-2">
            {data.resumeAdvice.map((a, i) => (
              <li key={i} className="rounded-lg bg-slate-50 p-2.5 text-sm">
                <span className="font-semibold text-slate-700">{a.section}:</span>{' '}
                <span className="text-slate-600">{a.change}</span>
                {a.why && <div className="mt-0.5 text-xs text-slate-400">↳ {a.why}</div>}
              </li>
            ))}
          </ul>
        </Card>
      )}

      {data.interview && (
        <Card title="Interview prep">
          {data.interview.focusAreas?.length > 0 && (
            <div className="mb-3">
              <SubHead>Focus areas</SubHead>
              <Chips items={data.interview.focusAreas} tone="accent" />
            </div>
          )}
          {data.interview.likelyQuestions?.length > 0 && (
            <div className="mb-3">
              <SubHead>Likely questions</SubHead>
              <Bullets items={data.interview.likelyQuestions} />
            </div>
          )}
          {data.interview.tips?.length > 0 && (
            <div>
              <SubHead>Tips</SubHead>
              <Bullets items={data.interview.tips} tone="emerald" />
            </div>
          )}
        </Card>
      )}

      {data.next7Days?.length > 0 && (
        <Card title="Your next 7 days">
          <Bullets items={data.next7Days} tone="accent" />
        </Card>
      )}

      <Card bodyClassName="px-4 pb-3 pt-0 sm:px-5">
        <Sources sources={sources} grounded={grounded} />
      </Card>
    </div>
  )
}

function SubHead({ children }) {
  return <div className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-slate-400">{children}</div>
}
