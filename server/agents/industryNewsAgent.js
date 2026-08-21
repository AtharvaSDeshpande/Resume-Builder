import { config } from '../config.js'
import { generateJSON } from '../llm/gemini.js'
import { fetchRecentNews } from '../tools/news.js'
import { buildIndustryNewsSummaryPrompt, inferIndustryQuery } from '../prompts/agents.js'

/**
 * Industry News — real recent stories, no paid grounding key required.
 *
 * Workaround for the free-tier grounding 429: instead of asking the model to
 * "search" (which it can't reliably do here), we FETCH real, dated headlines
 * from Google News RSS and hand those to the model purely to summarise and
 * assess impact. So the news is genuinely from the last 7 days and sourced, and
 * the model never invents a story. If the feed is empty/unreachable, we fall
 * back to the model's own knowledge (clearly flagged as ungrounded).
 */
export async function runIndustryNews(input = {}) {
  const query = inferIndustryQuery(input)

  let items = []
  try {
    items = await fetchRecentNews({ query, sinceDays: 7, limit: 12 })
  } catch {
    items = []
  }

  // Grounded path: summarise the REAL fetched items.
  if (items.length) {
    const { system, prompt } = buildIndustryNewsSummaryPrompt({ input, query, items })
    const { data } = await generateJSON({ model: config.llm.models.tailor, system, prompt })
    const sources = items.map((it) => ({ title: `${it.title} — ${it.source || 'source'}`, url: it.url }))
    return {
      agentId: 'industryNews',
      data: reconcileDates(data, items),
      sources,
      grounded: true,
      model: config.llm.models.tailor,
      generatedAtMs: Date.now(),
    }
  }

  // Fallback: no feed items — let the model produce best-effort recent context.
  const { buildIndustryNewsPrompt } = await import('../prompts/agents.js')
  const { system, prompt } = buildIndustryNewsPrompt(input)
  const { data } = await generateJSON({ model: config.llm.models.tailor, system, prompt })
  return { agentId: 'industryNews', data, sources: [], grounded: false, model: config.llm.models.tailor, generatedAtMs: Date.now() }
}

/** Keep model output honest: attach the real feed URL/date to each article by title match. */
function reconcileDates(data, items) {
  if (!data || !Array.isArray(data.articles)) return data
  const byTitle = (t) => items.find((it) => similar(it.title, t))
  data.articles = data.articles.map((a) => {
    const src = byTitle(a.headline || '')
    return src ? { ...a, date: a.date || src.date, url: src.url, source: src.source } : a
  })
  return data
}

function similar(a = '', b = '') {
  const norm = (s) => s.toLowerCase().replace(/[^a-z0-9 ]/g, '').trim()
  const x = norm(a)
  const y = norm(b)
  return x && y && (x.includes(y.slice(0, 24)) || y.includes(x.slice(0, 24)))
}
