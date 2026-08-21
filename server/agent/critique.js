import restrictions from '../../src/data/restrictions.json' with { type: 'json' }
import { config } from '../config.js'
import { generateJSON } from '../llm/gemini.js'
import { buildCritiquePrompt } from '../prompts/agentPrompts.js'

/**
 * The critique / "JD fit" reviewer. Used both inside the tailoring agent's
 * improvement loop AND by the standalone POST /api/score endpoint, so scoring a
 * résumé against a JD is a single, cheap LLM call reusable on its own.
 *
 * @returns {{ score, jdCoverage:{covered,missing}, weaknesses, suggestions }}
 */
export async function critiqueResume({ profile, jobDescription, requirements = {} }) {
  try {
    const { data } = await generateJSON({
      model: config.llm.models.critique,
      prompt: buildCritiquePrompt({
        tailoredProfile: profile,
        jobDescription,
        requirements,
        restrictionsGuidelines: restrictions.writingGuidelines,
      }),
    })
    return {
      score: typeof data?.score === 'number' ? clampScore(data.score) : null,
      jdCoverage: normalizeCoverage(data?.jdCoverage),
      weaknesses: Array.isArray(data?.weaknesses) ? data.weaknesses : [],
      suggestions: Array.isArray(data?.suggestions) ? data.suggestions : [],
    }
  } catch {
    return { score: null, jdCoverage: { covered: [], missing: [] }, weaknesses: [], suggestions: [] }
  }
}

const clampScore = (n) => Math.max(0, Math.min(100, Math.round(n)))

function normalizeCoverage(c) {
  return {
    covered: Array.isArray(c?.covered) ? c.covered : [],
    missing: Array.isArray(c?.missing) ? c.missing : [],
  }
}
