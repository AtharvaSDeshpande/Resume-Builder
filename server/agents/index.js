import { config } from '../config.js'
import { generateJSON } from '../llm/gemini.js'
import { buildCompanyIntelPrompt, buildPlacementBuddyPrompt } from '../prompts/agents.js'
import { runPlacementBuddy } from './placementBuddyAgent.js'
import { runIndustryNews } from './industryNewsAgent.js'

/**
 * Pluggable agent registry. Each agent is one of two shapes:
 *   • prompt agent — a `build(input) → {system, prompt}` single JSON call.
 *   • true agent   — a `run(input)` that drives its own tool-using loop.
 * Adding a new one = one entry here (+ its prompt/runner + a UI renderer).
 */
export const AGENTS = {
  // Prompt agent: one grounded call for company research.
  companyIntel: { id: 'companyIntel', label: 'Company Intel', useSearch: true, build: buildCompanyIntelPrompt },
  // True agent: model-directed tool loop (analyze résumé + research the role).
  placementBuddy: { id: 'placementBuddy', label: 'Placement Buddy', agentic: true, run: runPlacementBuddy },
  // Tool-backed agent: fetches REAL recent headlines, then summarises them.
  industryNews: { id: 'industryNews', label: 'Industry News', agentic: true, run: runIndustryNews },
}

export const isAgent = (id) => Object.prototype.hasOwnProperty.call(AGENTS, id)

export async function runAgent(id, input) {
  const agent = AGENTS[id]
  if (!agent) throw Object.assign(new Error(`Unknown agent "${id}".`), { status: 404, code: 'UNKNOWN_AGENT' })

  // True agents own their control flow.
  if (typeof agent.run === 'function') return agent.run(input || {})

  // Prompt agents: uniform single JSON call.
  const { system, prompt } = agent.build(input || {})
  const { data, sources, modelUsed, grounded } = await generateJSON({
    model: config.llm.models.tailor,
    system,
    prompt,
    useSearch: agent.useSearch,
  })
  return { agentId: id, data, sources: sources || [], grounded: Boolean(grounded), model: modelUsed, generatedAtMs: Date.now() }
}
