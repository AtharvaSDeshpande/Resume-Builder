import restrictions from '../../src/data/restrictions.json' with { type: 'json' }
import { validateProfile } from '../../src/utils/validation.js'
import { applyIntegrityGuards } from '../../src/ai/integrityGuards.js'
import { buildSystemPrompt, buildUserPrompt, promptMeta } from '../../src/ai/resumeCustomization.js'
import { config } from '../config.js'
import { generateJSON, resolveBestModel, prettyModel } from '../llm/gemini.js'
import { buildJdParsePrompt, buildImprovePrompt } from '../prompts/agentPrompts.js'
import { critiqueResume } from './critique.js'

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
export async function runTailorAgent({ baseResume, jobDescription, additionalContext = '', onProgress = () => {} }) {
  if (!baseResume || typeof baseResume !== 'object') throw bad('A base résumé is required.')
  if (!jobDescription || !String(jobDescription).trim()) throw bad('A job description is required.')

  // 0) Pick the best model the user's key can use (Pro if available), and tell
  //    the user which one is doing the heavy lifting.
  onProgress({ stage: 'model', label: 'Checking which Gemini model your key can use…' })
  const genModel = await resolveBestModel()
  onProgress({ stage: 'model', model: genModel, label: `Using ${prettyModel(genModel)} — the best model available on your key.` })

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
    model: genModel,
    system: buildSystemPrompt(),
    prompt: buildUserPrompt({ baseResume, jobDescription: augmentedJd, restrictions, additionalContext }),
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

  // 5) Improvement loop — bounded, but the MODEL decides whether each further
  //    pass is worth it (and what to prioritise), instead of a fixed score gate.
  //    A hard validation error always forces another pass; otherwise the agent
  //    reflects and may stop early to avoid over-tailoring.
  let attempts = 1
  while (attempts <= config.agent.maxImproveAttempts) {
    const mustFix = best.validation.count > 0
    let focus = ''
    if (!mustFix) {
      const decision = await decideNextAction({ review, attempt: attempts, maxAttempts: config.agent.maxImproveAttempts })
      if (!decision.continue) break
      focus = decision.focus
    }
    onProgress({
      stage: 'improve',
      label: focus ? `Refining: ${focus} (pass ${attempts})…` : `Refining for a stronger match (pass ${attempts})…`,
      attempt: attempts,
    })
    let improved
    try {
      improved = await generateJSON({
        model: genModel,
        prompt: buildImprovePrompt({
          baseResume,
          tailoredProfile: best.profile,
          suggestions: review.suggestions,
          missingKeywords: review.jdCoverage?.missing,
          restrictions: compactLimits(),
          additionalContext,
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

const critique = (profile, jobDescription, requirements) =>
  critiqueResume({ profile, jobDescription, requirements })

/**
 * The agent's own controller: given the latest fit review, decide whether
 * another revision pass is worth it and what to focus on. Lets the model stop
 * early on a strong résumé (avoiding over-tailoring) rather than always burning
 * every allotted pass. Best-effort — defaults to continuing on any failure.
 */
async function decideNextAction({ review, attempt, maxAttempts }) {
  try {
    const { data } = await generateJSON({
      model: config.llm.models.critique,
      prompt: [
        "You are the résumé-tailoring agent's controller deciding your next move.",
        `This is attempt ${attempt} of at most ${maxAttempts}.`,
        'Current fit review:',
        JSON.stringify({ score: review.score, weaknesses: review.weaknesses, missing: review.jdCoverage?.missing, suggestions: review.suggestions }, null, 2),
        'Decide whether ANOTHER revision pass would meaningfully improve the fit. Stop if the résumé is already strong, or if further edits would risk over-tailoring, padding, or quality loss.',
        'Respond as JSON only: {"continue": boolean, "reason": "string", "focus": "the single highest-leverage thing to fix next"}',
      ].join('\n'),
    })
    return { continue: Boolean(data?.continue), reason: data?.reason || '', focus: data?.focus || '' }
  } catch {
    return { continue: true, focus: '' }
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
