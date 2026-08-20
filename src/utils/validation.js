/**
 * Validation engine.
 *
 * Two tiers:
 *   • ERRORS   — hard layout limits (character caps, item counts). Breaching one
 *                risks overflowing the single A4 page. Rendered as red flags;
 *                gate saving/printing decisions.
 *   • ADVISORY — GLIM-C writing-guideline suggestions (weak bullet openers,
 *                unquantified impact, over-precise marks, missing certificate
 *                metadata). These never block anything; they nudge quality.
 *
 * Character caps are measured against the *rendered* text, so we strip the
 * lightweight **bold** markdown before counting.
 */

/** Remove **bold** markers so counts reflect what the reader actually sees. */
export function stripMarkdown(text = '') {
  return String(text).replace(/\*\*(.*?)\*\*/g, '$1')
}

const len = (text) => stripMarkdown(text).trim().length
const clean = (text) => stripMarkdown(text).trim()

/**
 * @returns {{
 *   flags: Record<string,string>, list: Array, count: number,
 *   advisoryFlags: Record<string,string>, advisories: Array, advisoryCount: number
 * }}
 */
export function validateProfile(profile, restrictions) {
  const flags = {}
  const list = []
  const advisoryFlags = {}
  const advisories = []
  const S = restrictions.sections
  const G = restrictions.writingGuidelines || {}

  const flag = (path, section, message) => {
    flags[path] = message
    list.push({ path, section, message })
  }
  const advise = (path, section, message) => {
    if (!advisoryFlags[path]) advisoryFlags[path] = message // first advisory wins the inline slot
    advisories.push({ path, section, message })
  }
  const checkMax = (path, section, value, max, label) => {
    if (max != null && len(value) > max) {
      flag(path, section, `${label} is ${len(value)} chars (max ${max}).`)
    }
  }

  const weakOpeners = new Set((G.weakOpeners || []).map((w) => w.toLowerCase()))
  const firstWord = (text) => clean(text).split(/\s+/)[0]?.replace(/[^a-zA-Z]/g, '').toLowerCase() || ''
  const startsLower = (text) => /^[a-z]/.test(clean(text))
  const hasNumber = (text) => /\d/.test(clean(text))

  // ---- Header ----
  if (profile.header) {
    const h = S.header.fields
    checkMax('header.name', 'header', profile.header.name, h.name.maxChars, 'Name')
    ;(profile.header.meta || []).forEach((line, i) => {
      checkMax(`header.meta.${i}`, 'header', line, h.meta.maxCharsPerLine, 'Meta line')
    })
    if ((profile.header.meta || []).length > h.meta.maxLines) {
      flag('header.meta', 'header', `${profile.header.meta.length} meta lines (max ${h.meta.maxLines}).`)
    }
  }

  // ---- Profile summary ----
  if (profile.profileSummary) {
    checkMax('profileSummary.summary', 'profileSummary', profile.profileSummary.summary, S.profileSummary.summary.maxChars, 'Summary')
    const boldCount = (String(profile.profileSummary.summary || '').match(/\*\*[^*]+\*\*/g) || []).length
    if (boldCount === 0) advise('profileSummary.summary', 'profileSummary', 'Bold one key skill in the summary (GLIM guideline).')
  }

  // ---- Experience-style list sections (entries with heading + bullets) ----
  const entrySections = [
    { key: 'professionalExperience', headKey: 'heading' },
    { key: 'academicProjects', headKey: 'title' },
  ]
  for (const { key, headKey } of entrySections) {
    const cfg = S[key]
    const entries = profile[key] || []
    if (entries.length > cfg.entries.max) flag(`${key}`, key, `${entries.length} entries (max ${cfg.entries.max}).`)

    entries.forEach((entry, ei) => {
      checkMax(`${key}.${ei}.${headKey}`, key, entry[headKey], cfg.entry[headKey].maxChars, 'Heading')
      const bullets = entry.bullets || []
      if (bullets.length > cfg.entry.bullets.max) flag(`${key}.${ei}.bullets`, key, `${bullets.length} bullets (max ${cfg.entry.bullets.max}).`)
      if (bullets.length < cfg.entry.bullets.min) flag(`${key}.${ei}.bullets`, key, `${bullets.length} bullets (min ${cfg.entry.bullets.min}).`)

      bullets.forEach((b, bi) => {
        const path = `${key}.${ei}.bullets.${bi}`
        checkMax(path, key, b, cfg.entry.bullets.maxCharsPerBullet, 'Bullet')
        // GLIM: every bullet starts with a strong action verb.
        if (weakOpeners.has(firstWord(b))) {
          advise(path, key, `Start with an action verb — avoid "${firstWord(b)}…".`)
        } else if (startsLower(b)) {
          advise(path, key, 'Start the bullet with a capitalized action verb.')
        }
      })

      // GLIM: quantify impact — at least one bullet in the entry has a number.
      if (cfg.requireQuantification && bullets.length && !bullets.some(hasNumber)) {
        advise(`${key}.${ei}.bullets`, key, 'Quantify the impact with a number or % in at least one bullet.')
      }
    })
  }

  // ---- Simple bullet-list sections ----
  const bulletSections = ['keySkills', 'certificates', 'awards', 'positionsOfResponsibility', 'extraCurriculars', 'languages']
  for (const key of bulletSections) {
    const cfg = S[key]
    const items = profile[key] || []
    if (items.length > cfg.items.max) flag(`${key}`, key, `${items.length} items (max ${cfg.items.max}).`)
    if (items.length < cfg.items.min) flag(`${key}`, key, `${items.length} items (min ${cfg.items.min}).`)
    items.forEach((item, i) => {
      checkMax(`${key}.${i}`, key, item, cfg.items.maxCharsPerItem, 'Item')
      // GLIM: certificates should carry a year (and ideally duration).
      if (key === 'certificates' && item && !/\b(19|20)\d{2}\b/.test(item)) {
        advise(`${key}.${i}`, key, 'Add the year & duration, e.g. "| 2025 | 8 weeks".')
      }
    })
  }

  // ---- Qualifications table ----
  {
    const cfg = S.qualifications
    const rows = profile.qualifications || []
    if (rows.length > cfg.rows.max) flag('qualifications', 'qualifications', `${rows.length} rows (max ${cfg.rows.max}).`)
    const maxDec = cfg.cell.score.maxDecimals
    rows.forEach((row, ri) => {
      checkMax(`qualifications.${ri}.degree`, 'qualifications', row.degree, cfg.cell.degree.maxChars, 'Degree')
      checkMax(`qualifications.${ri}.institute`, 'qualifications', row.institute, cfg.cell.institute.maxChars, 'Institute')
      checkMax(`qualifications.${ri}.score`, 'qualifications', row.score, cfg.cell.score.maxChars, 'Score')
      checkMax(`qualifications.${ri}.year`, 'qualifications', row.year, cfg.cell.year.maxChars, 'Year')
      // GLIM: no 3rd decimal place in marks.
      const dec = String(row.score || '').match(/\.(\d+)/)
      if (maxDec != null && dec && dec[1].length > maxDec) {
        advise(`qualifications.${ri}.score`, 'qualifications', `Round marks to ${maxDec} decimals.`)
      }
    })
  }

  return {
    flags,
    list,
    count: list.length,
    advisoryFlags,
    advisories,
    advisoryCount: advisories.length,
  }
}
