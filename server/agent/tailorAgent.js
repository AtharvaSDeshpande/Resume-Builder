import restrictions from '../../src/data/restrictions.json' with { type: 'json' }
import { validateProfile } from '../../src/utils/validation.js'
import { applyIntegrityGuards } from '../../src/ai/integrityGuards.js'
import { buildSystemPrompt, buildUserPrompt, promptMeta } from '../../src/ai/resumeCustomization.js'
import { config } from '../config.js'
import { generateJSON } from '../llm/gemini.js'
import { buildJdParsePrompt, buildCritiquePrompt, buildImprovePrompt } from '../prompts/agentPrompts.js'

/**
 * The tailoring agent. Optimises for output quality/relevance via distinct
 * reasoning stages instead of one monolithic call:
 *
 *   1. parse    — turn the JD into structured requirements (cheap model)
 *   2. tailor   — rewrite the résumé toward those requirements (strong model)
 *   3. guard    — deterministic integrity guards + restriction validation
 *   4. critique — an LLM reviewer scores fit/quality and lists concrete fixes
 *   5. improve  — apply the fixes; re-guard/validate/critique; keep the best
 *
 * Returns the best draft plus the parsed requirements, JD coverage, and score,
 * so the UI can show *why* it's a good fit.
 */
export async function runTailorAgent({ baseResume, jobDescription, onProgress = () => {} }) {
  if (!baseResume || typeof baseResume !== 'object') throw bad('A base résumé is required.')
  if (!jobDescription || !String(jobDescription).trim()) throw bad('A job description is required.')

  // 1) Parse the JD (best-effort — the tailor still works without it).
  onProgress({ stage: 'parse', label: 'Reading the job description…' })
  let requirements = {}
  try {
    requirements = (await generateJSON({ model: config.llm.models.parse, prompt: buildJdParsePrompt(jobDescription) })).data || {}
  } catch {
    requirements = {}
  }

  // 2) Tailor, feeding the parsed requirements alongside the raw JD.
  const augmentedJd = [
    jobDescription.trim(),
    '',
    '--- Parsed requirements (target these) ---',
    JSON.stringify(requirements, null, 2),
  ].join('\n')

  onProgress({ stage: 'tailor', label: 'Tailoring your résumé to the role…' })
  const tailorOut = await generateJSON({
    model: config.llm.models.tailor,
    system: buildSystemPrompt(),
    prompt: buildUserPrompt({ baseResume, jobDescription: augmentedJd, restrictions }),
  })
  const modelUsed = tailorOut.modelUsed
  const company = typeof tailorOut.data?.targetCompany === 'string' ? tailorOut.data.targetCompany.trim() : ''

  // 3) Guard + validate the first draft.
  onProgress({ stage: 'validate', label: 'Checking guidelines & one-page limits…' })
  let changeLog = Array.isArray(tailorOut.data?.changeLog) ? tailorOut.data.changeLog : []
  let current = finalize(tailorOut.data, baseResume)

  // 4) Critique it.
  onProgress({ stage: 'review', label: 'Reviewing fit for the job…' })
  let review = await critique(current.profile, jobDescription, requirements)
  let best = snapshot(current, changeLog, review)

  // 5) Improvement loop (targeted, bounded).
  let attempts = 1
  while (
    attempts <= config.agent.maxImproveAttempts &&
    (best.validation.count > 0 || (best.score ?? 0) < config.agent.targetScore)
  ) {
    onProgress({ stage: 'improve', label: `Refining for a stronger match (pass ${attempts})…`, attempt: attempts })
    let improved
    try {
      improved = await generateJSON({
        model: config.llm.models.tailor,
        prompt: buildImprovePrompt({
          baseResume,
          tailoredProfile: best.profile,
          suggestions: review.suggestions,
          missingKeywords: review.jdCoverage?.missing,
          restrictions: compactLimits(),
        }),
      })
    } catch {
      break // improvement is best-effort; keep what we have
    }

    const cand = finalize(improved.data, baseResume)
    const candChangeLog = [...best.changeLog, ...(Array.isArray(improved.data?.changeLog) ? improved.data.changeLog : [])]
    review = await critique(cand.profile, jobDescription, requirements)
    const candidate = snapshot(cand, candChangeLog, review)

    best = pickBetter(best, candidate)
    attempts += 1
    if (best.validation.count === 0 && (best.score ?? 0) >= config.agent.targetScore) break
  }

  return {
    profile: best.profile,
    company,
    requirements,
    jdCoverage: best.jdCoverage,
    weaknesses: best.weaknesses,
    score: best.score,
    changeLog: best.changeLog,
    corrections: best.corrections,
    validation: best.validation,
    model: modelUsed,
    promptVersion: promptMeta.version,
    attempts,
  }
}

/** Guards + identity metadata + validation for a raw model output. */
function finalize(raw, baseResume) {
  const candidate = raw?.profile ?? raw
  const { profile, corrections } = applyIntegrityGuards(baseResume, candidate, { skillsPolicy: config.agent.skillsPolicy })
  profile.profileId = `${baseResume.profileId}__tailored`
  profile.profileName = baseResume.profileName
  profile.profileRole = baseResume.profileRole
  return { profile, corrections, validation: validateProfile(profile, restrictions) }
}

function snapshot(finalized, changeLog, review) {
  return {
    ...finalized,
    changeLog,
    score: review.score,
    jdCoverage: review.jdCoverage,
    weaknesses: review.weaknesses,
  }
}

/** Prefer fewer hard errors; tie-break on higher rubric score. */
function pickBetter(a, b) {
  if (a.validation.count !== b.validation.count) return a.validation.count < b.validation.count ? a : b
  return (a.score ?? 0) >= (b.score ?? 0) ? a : b
}

async function critique(tailoredProfile, jobDescription, requirements) {
  try {
    const { data } = await generateJSON({
      model: config.llm.models.critique,
      prompt: buildCritiquePrompt({
        tailoredProfile,
        jobDescription,
        requirements,
        restrictionsGuidelines: restrictions.writingGuidelines,
      }),
    })
    return {
      score: typeof data?.score === 'number' ? data.score : null,
      jdCoverage: data?.jdCoverage || { covered: [], missing: [] },
      weaknesses: Array.isArray(data?.weaknesses) ? data.weaknesses : [],
      suggestions: Array.isArray(data?.suggestions) ? data.suggestions : [],
    }
  } catch {
    return { score: null, jdCoverage: { covered: [], missing: [] }, weaknesses: [], suggestions: [] }
  }
}

/** Just the numeric limits for the improve prompt (keeps it compact). */
function compactLimits() {
  const out = {}
  for (const [k, cfg] of Object.entries(restrictions.sections)) {
    const { type, variant, columns, label, guidelines, format, ...rest } = cfg
    out[k] = rest
  }
  return out
}

const bad = (m) => Object.assign(new Error(m), { status: 400, code: 'BAD_REQUEST' })
