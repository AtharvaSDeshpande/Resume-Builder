import { stripMarkdown } from '../utils/validation.js'

/**
 * Deterministic anti-fabrication guards.
 *
 * The prompt *asks* the model not to invent things, but we don't rely on trust
 * for the parts we can verify mechanically. Identity, education, employers,
 * titles and dates are ALWAYS locked to the base resume. The "creative" surface
 * — skills — is governed by a configurable policy so tailoring has room to
 * breathe:
 *
 *   'subset'   – skills must already be in the base resume (strictest).
 *   'grounded' – skills may be reworded/added when evidenced by the base
 *                resume's real experience/projects (default).
 *   'open'     – keep whatever the model returns (trust the prompt entirely).
 *
 * Returns { profile, corrections } where corrections lists what we overrode.
 */
export function applyIntegrityGuards(baseResume, candidate, options = {}) {
  const { skillsPolicy = 'grounded' } = options
  const corrections = []
  const profile = structuredClone(candidate)

  // 1. Skills — freedom governed by policy.
  if (Array.isArray(profile.keySkills)) {
    profile.keySkills = applySkillsPolicy(baseResume, profile.keySkills, skillsPolicy, corrections)
  }

  // 2. Education/qualifications and footer are locked facts — restore verbatim.
  for (const lockedKey of ['qualifications', 'footer']) {
    if (baseResume[lockedKey] !== undefined) {
      if (!deepEqual(profile[lockedKey], baseResume[lockedKey])) {
        corrections.push(`Restored "${lockedKey}" to base resume (locked field).`)
      }
      profile[lockedKey] = structuredClone(baseResume[lockedKey])
    }
  }

  // Header identity (name/contact/logo) may never change.
  if (baseResume.header) {
    if (!deepEqual(profile.header, baseResume.header)) {
      corrections.push('Restored header identity (name/contact/logo) to base resume.')
    }
    profile.header = structuredClone(baseResume.header)
  }

  // 3. Experience/project company·title·date lines are locked; bullets are free.
  lockHeadings(baseResume, profile, 'professionalExperience', 'heading', corrections)
  lockHeadings(baseResume, profile, 'academicProjects', 'title', corrections)

  return { profile, corrections }
}

function applySkillsPolicy(base, skills, policy, corrections) {
  const baseSkills = Array.isArray(base.keySkills) ? base.keySkills : []
  const baseByNorm = new Map(baseSkills.map((s) => [norm(s), s]))

  if (policy === 'open') return skills.slice()

  if (policy === 'subset') {
    const kept = []
    for (const skill of skills) {
      const match = baseByNorm.get(norm(skill))
      if (match) kept.push(match)
      else corrections.push(`Removed "${skill}" — not in base resume (subset policy).`)
    }
    return kept.length ? kept : [...baseSkills]
  }

  // grounded (default)
  const corpus = baseResumeText(base)
  const kept = []
  for (const skill of skills) {
    if (baseByNorm.get(norm(skill))) kept.push(skill)
    else if (isGroundedIn(skill, corpus)) kept.push(skill)
    else corrections.push(`Removed "${skill}" — no basis in base resume (grounded policy).`)
  }
  return kept.length ? kept : [...baseSkills]
}

function isGroundedIn(skill, corpus) {
  const words = tokenize(skill).filter((w) => w.length >= 4 && !STOPWORDS.has(w))
  if (words.length === 0) return false
  return words.some((w) => corpus.includes(w))
}

function baseResumeText(base) {
  const parts = []
  if (base.profileSummary?.summary) parts.push(base.profileSummary.summary)
  for (const key of ['professionalExperience', 'academicProjects']) {
    for (const entry of base[key] || []) {
      if (entry.heading) parts.push(entry.heading)
      if (entry.title) parts.push(entry.title)
      parts.push(...(entry.bullets || []))
    }
  }
  parts.push(...(base.keySkills || []))
  return stripMarkdown(parts.join(' ')).toLowerCase()
}

const STOPWORDS = new Set([
  'and', 'the', 'for', 'with', 'skills', 'skill', 'management', 'development',
  'general', 'various', 'other', 'work', 'using', 'based',
])

const tokenize = (s) =>
  stripMarkdown(String(s ?? '')).toLowerCase().split(/[^a-z0-9+#]+/).filter(Boolean)

function lockHeadings(base, profile, key, field, corrections) {
  const baseEntries = base[key]
  if (!Array.isArray(baseEntries) || !Array.isArray(profile[key])) return
  profile[key].forEach((entry, i) => {
    const baseEntry = baseEntries[i]
    if (!baseEntry) return
    if (norm(entry[field]) !== norm(baseEntry[field])) {
      corrections.push(`Restored ${key}[${i}] ${field} to base wording (locked line).`)
      entry[field] = baseEntry[field]
    }
  })
}

const norm = (s) => stripMarkdown(String(s ?? '')).trim().toLowerCase()

function deepEqual(a, b) {
  return JSON.stringify(a) === JSON.stringify(b)
}
