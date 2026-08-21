import { config } from '../config.js'
import { runToolAgent, generateJSON } from '../llm/gemini.js'
import { buildPlacementBuddyPrompt } from '../prompts/agents.js'

/**
 * Placement Buddy — a GENUINE agent (not a single prompt).
 *
 * It runs a tool-using loop where the MODEL decides what to do: inspect the
 * candidate's résumé section-by-section, research the role/industry as many
 * times as it judges necessary, and only then synthesise the final plan. The
 * control flow and stopping point are the model's, not ours — that's what makes
 * it agentic. Tools:
 *   • analyze_candidate(focus) — pull a slice of THIS résumé (local, grounded)
 *   • research(query)          — look up role/industry facts (web-grounded, with
 *                                graceful degradation to model knowledge)
 * When it has enough, it stops calling tools and emits the plan JSON.
 */
export async function runPlacementBuddy(input = {}) {
  const { profile } = input
  const base = buildPlacementBuddyPrompt(input) // reuse the schema + framing

  const system = [
    base.system,
    '',
    'You operate as an AGENT with tools. Work in steps:',
    '  1) Call analyze_candidate to understand the résumé (strengths AND gaps) — call it for each focus you need.',
    '  2) Call research to gather current, concrete facts about the role, required skills, and industry expectations.',
    '  3) Repeat research until you can give specific, personalised, non-generic advice.',
    'Only AFTER researching, STOP calling tools and respond with the final JSON object (the schema above) and nothing else.',
    'Base every recommendation on what the tools returned; never fabricate the candidate’s experience.',
  ].join('\n')

  const tools = {
    analyze_candidate: {
      declaration: {
        name: 'analyze_candidate',
        description: "Return a slice of the candidate's résumé to reason about their real strengths and gaps.",
        parameters: {
          type: 'OBJECT',
          properties: {
            focus: {
              type: 'STRING',
              description: 'One of: summary, skills, experience, projects, education, all',
            },
          },
          required: ['focus'],
        },
      },
      handler: async ({ focus }) => ({ result: analyzeCandidate(profile, focus), summary: `analyzed résumé (${focus})` }),
    },
    research: {
      declaration: {
        name: 'research',
        description: 'Research the target role, required skills, or industry to ground the advice in current facts.',
        parameters: {
          type: 'OBJECT',
          properties: { query: { type: 'STRING', description: 'A focused research question.' } },
          required: ['query'],
        },
      },
      handler: async ({ query }) => {
        const { data, sources } = await generateJSON({
          model: config.llm.models.parse, // cheap model for the retrieval step
          prompt: `Research this and report concise, factual, up-to-date findings.\nQuestion: ${query}\nRespond as JSON: {"findings": string[]}`,
          useSearch: true,
        })
        return {
          result: { findings: Array.isArray(data?.findings) ? data.findings : [] },
          sources,
          summary: `researched: ${query}`,
        }
      },
    },
  }

  const { data, steps, sources, modelUsed } = await runToolAgent({
    model: config.llm.models.tailor,
    system,
    prompt: base.prompt,
    tools,
    maxSteps: 6,
  })

  return {
    agentId: 'placementBuddy',
    data,
    steps,
    sources: sources || [],
    grounded: (sources || []).length > 0,
    model: modelUsed,
    generatedAtMs: Date.now(),
  }
}

/** Local, deterministic view of the candidate — the analyze_candidate tool. */
function analyzeCandidate(profile, focus) {
  if (!profile || typeof profile !== 'object') return { note: 'No résumé provided.' }
  const slices = {
    summary: () => ({ summary: profile.profileSummary?.summary || '' }),
    skills: () => ({ skills: profile.keySkills || [] }),
    experience: () => ({
      experience: (profile.professionalExperience || []).map((e) => ({ heading: e.heading, points: e.points })),
    }),
    projects: () => ({
      projects: (profile.academicProjects || []).map((p) => ({ title: p.title, description: p.description })),
    }),
    education: () => ({
      education: (profile.qualifications || []).map((q) => ({ degree: q.degree, institute: q.institute, score: q.score })),
    }),
  }
  if (focus === 'all' || !slices[focus]) {
    return Object.fromEntries(Object.entries(slices).map(([k, fn]) => [k, fn()[k]]))
  }
  return slices[focus]()
}
