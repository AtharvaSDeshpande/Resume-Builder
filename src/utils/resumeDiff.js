import { stripMarkdown } from './validation.js'

/**
 * Computes a visual diff between a base résumé and its AI-tailored version.
 *
 * Output is keyed by the SAME "path" scheme the renderer/validator use
 * (`profileSummary.summary`, `keySkills.2`, `professionalExperience.0.bullets.1`,
 * …), so the canvas can highlight each node with zero extra plumbing:
 *
 *   marks[path] = { status: 'added' }                      → whole node is new
 *   marks[path] = { status: 'changed', tokens: [...] }     → word-level rewrite
 *   removed     = [{ section, text }]                      → present in base, gone now
 *
 * List items (skills, bullets) are matched by word-overlap similarity, so
 * reordering doesn't register as a change.
 */
export function computeResumeDiff(base, tailored) {
  const marks = {}
  const removed = []
  if (!base || !tailored) return { marks, removed }

  // Profile summary (single text field).
  const bs = base.profileSummary?.summary
  const ts = tailored.profileSummary?.summary
  if (ts && norm(bs) !== norm(ts)) {
    marks['profileSummary.summary'] = { status: 'changed', tokens: wordDiff(bs || '', ts) }
  }

  // Experience & projects: headings (usually locked) + bullets.
  for (const [key, headKey] of [
    ['professionalExperience', 'heading'],
    ['academicProjects', 'title'],
  ]) {
    const bEntries = base[key] || []
    const tEntries = tailored[key] || []
    tEntries.forEach((entry, ei) => {
      const bEntry = bEntries[ei]
      if (bEntry && norm(entry[headKey]) !== norm(bEntry[headKey])) {
        marks[`${key}.${ei}.${headKey}`] = { status: 'changed', tokens: wordDiff(bEntry[headKey] || '', entry[headKey] || '') }
      }
      const r = diffList(bEntry?.bullets || [], entry.bullets || [], (bi) => `${key}.${ei}.bullets.${bi}`)
      Object.assign(marks, r.marks)
      r.removed.forEach((text) => removed.push({ section: key, text }))
    })
  }

  // Simple bullet-list sections.
  for (const key of ['keySkills', 'certificates', 'awards', 'positionsOfResponsibility', 'extraCurriculars', 'languages']) {
    const r = diffList(base[key] || [], tailored[key] || [], (i) => `${key}.${i}`)
    Object.assign(marks, r.marks)
    r.removed.forEach((text) => removed.push({ section: key, text }))
  }

  return { marks, removed }
}

/** Diff two string lists: mark each tailored item, collect removed base items. */
function diffList(baseItems, tailoredItems, pathFor) {
  const marks = {}
  const used = new Array(baseItems.length).fill(false)

  tailoredItems.forEach((item, ti) => {
    let bestIdx = -1
    let bestSim = 0
    baseItems.forEach((b, bi) => {
      if (used[bi]) return
      const s = similarity(item, b)
      if (s > bestSim) {
        bestSim = s
        bestIdx = bi
      }
    })
    const path = pathFor(ti)
    if (bestIdx >= 0 && bestSim >= 1) {
      used[bestIdx] = true // identical (order-insensitive) → unchanged
    } else if (bestIdx >= 0 && bestSim >= 0.34) {
      used[bestIdx] = true // reworded from a base item → word diff
      marks[path] = { status: 'changed', tokens: wordDiff(baseItems[bestIdx], item) }
    } else {
      marks[path] = { status: 'added' } // no plausible base match → brand new
    }
  })

  const removed = baseItems.filter((_, bi) => !used[bi]).map((b) => clean(b))
  return { marks, removed }
}

/* --------------------------------------------------------------- primitives */

const clean = (s) => stripMarkdown(String(s ?? '')).trim()
const norm = (s) => clean(s).toLowerCase().replace(/\s+/g, ' ')
const displayWords = (s) => clean(s).split(/\s+/).filter(Boolean)
const tokenSet = (s) => new Set(norm(s).split(/[^a-z0-9+#]+/).filter(Boolean))

/** Jaccard overlap of word sets — order-insensitive similarity in [0,1]. */
function similarity(a, b) {
  const A = tokenSet(a)
  const B = tokenSet(b)
  if (!A.size && !B.size) return 1
  let inter = 0
  for (const t of A) if (B.has(t)) inter += 1
  return inter / (A.size + B.size - inter)
}

/** Word-level LCS diff → [{ text, type: 'same' | 'add' | 'del' }]. */
export function wordDiff(oldStr, newStr) {
  const o = displayWords(oldStr)
  const n = displayWords(newStr)
  const m = o.length
  const k = n.length

  // dp[i][j] = LCS length of o[i:] and n[j:]
  const dp = Array.from({ length: m + 1 }, () => new Array(k + 1).fill(0))
  for (let i = m - 1; i >= 0; i--) {
    for (let j = k - 1; j >= 0; j--) {
      dp[i][j] =
        norm(o[i]) === norm(n[j]) ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1])
    }
  }

  const out = []
  let i = 0
  let j = 0
  while (i < m && j < k) {
    if (norm(o[i]) === norm(n[j])) {
      out.push({ text: n[j], type: 'same' })
      i++
      j++
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      out.push({ text: o[i], type: 'del' })
      i++
    } else {
      out.push({ text: n[j], type: 'add' })
      j++
    }
  }
  while (i < m) out.push({ text: o[i++], type: 'del' })
  while (j < k) out.push({ text: n[j++], type: 'add' })
  return out
}
