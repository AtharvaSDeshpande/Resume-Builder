import React, { useState } from 'react'
import { useData } from '../../data/AppData.jsx'
import { agentApi } from '../../services/agentApi.js'
import { formatDate } from '../../utils/format.js'
import Card from '../ui/Card.jsx'
import Button from '../ui/Button.jsx'
import { Spinner } from '../ui/ProgressPanel.jsx'

/**
 * Generic agent tab — the same shell for every career-prep agent. It handles
 * running the agent, saving its JSON onto the position, and the empty / loading
 * / error / result states. The agent-specific rendering is delegated to
 * `agentDef.View`, so a new agent needs zero changes here.
 */
export default function AgentTab({ position, agentDef }) {
  const { saveAgentResult } = useData()
  const [running, setRunning] = useState(false)
  const [error, setError] = useState(null)

  const saved = position.agents?.[agentDef.id]
  const View = agentDef.View

  async function run() {
    setRunning(true)
    setError(null)
    try {
      const result = await agentApi.runAgent(agentDef.id, {
        company: position.company,
        jobDescription: position.jobDescription,
        requirements: position.feedback?.requirements,
        profile: position.tailored?.profile,
      })
      await saveAgentResult(position.id, agentDef.id, result)
    } catch (err) {
      setError(err.message || 'The agent could not complete.')
    } finally {
      setRunning(false)
    }
  }

  if (running) {
    return (
      <Card>
        <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
          <Spinner size={22} />
          <p className="text-sm font-medium text-slate-600">{agentDef.running}</p>
          <p className="text-xs text-slate-400">This can take up to a minute.</p>
        </div>
      </Card>
    )
  }

  if (!saved) {
    return (
      <Card>
        <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
          <div className="mb-1 grid h-12 w-12 place-items-center rounded-2xl bg-accent/10 text-accent">
            <agentDef.icon />
          </div>
          <h3 className="text-base font-bold text-slate-800">{agentDef.label}</h3>
          <p className="max-w-md text-sm text-slate-500">{agentDef.tagline}</p>
          <Button className="mt-3" onClick={run}>
            {agentDef.cta}
          </Button>
          {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
        </div>
      </Card>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[11px] text-slate-400">
          Generated {saved.generatedAtMs ? formatDate(saved.generatedAtMs) : ''}
          {saved.grounded ? ' · web-grounded' : ''}
        </p>
        <Button size="sm" variant="secondary" onClick={run}>
          Refresh
        </Button>
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
      <View data={saved.data} sources={saved.sources} grounded={saved.grounded} steps={saved.steps} />
    </div>
  )
}
