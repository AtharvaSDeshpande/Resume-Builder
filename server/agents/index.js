import { config } from '../config.js'
import { generateJSON } from '../llm/gemini.js'
import { buildCompanyIntelPrompt, buildPlacementBuddyPrompt, buildIndustryNewsPrompt } from '../prompts/agents.js'

/**
 * Pluggable agent registry. Adding a new agent = one entry here (+ its prompt
 * builder + a UI renderer on the client). Each agent:
 *   - build(input)  → { system, prompt }
 *   - useSearch     → whether it needs live web grounding
 * The runner is uniform (same JSON-driven contract as the tailoring agent).
 */
export const AGENTS = {
  companyIntel: { id: 'companyIntel', label: 'Company Intel', useSearch: true, build: buildCompanyIntelPrompt },
  placementBuddy: { id: 'placementBuddy', label: 'Placement Buddy', useSearch: false, build: buildPlacementBuddyPrompt },
  industryNews: { id: 'industryNews', label: 'Industry News', useSearch: true, build: buildIndustryNewsPrompt },
}

export const isAgent = (id) => Object.prototype.hasOwnProperty.call(AGENTS, id)

export async function runAgent(id, input) {
  const agent = AGENTS[id]
  if (!agent) throw Object.assign(new Error(`Unknown agent "${id}".`), { status: 404, code: 'UNKNOWN_AGENT' })

  const { system, prompt } = agent.build(input || {})
  const { data, sources, modelUsed, grounded } = await generateJSON({
    model: config.llm.models.tailor, // the fuller flash model for richer insights
    system,
    prompt,
    useSearch: agent.useSearch,
  })

  return { agentId: id, data, sources: sources || [], grounded: Boolean(grounded), model: modelUsed, generatedAtMs: Date.now() }
}
