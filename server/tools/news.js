/**
 * Recent-news retrieval WITHOUT a paid grounding key.
 *
 * Gemini's Google-Search grounding returns 429 on the free tier, so the news
 * agent can't rely on it for genuinely recent stories. Instead we pull the
 * public Google News RSS feed (no API key, no auth), which already supports a
 * `when:7d` recency filter and returns real, dated, sourced headlines. The LLM
 * then only has to summarise/assess these real items — it never invents news.
 */

const FEED = 'https://news.google.com/rss/search'

/** Fetch real news items for a query, most-recent-first, from the last N days. */
export async function fetchRecentNews({ query, sinceDays = 7, limit = 12 }) {
  const q = `${query} when:${sinceDays}d`
  const url = `${FEED}?q=${encodeURIComponent(q)}&hl=en-US&gl=US&ceid=US:en`

  let xml
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; ResumeAgent/1.0)' },
      signal: AbortSignal.timeout(12000),
    })
    if (!res.ok) throw new Error(`News feed HTTP ${res.status}`)
    xml = await res.text()
  } catch (err) {
    throw Object.assign(new Error(`Could not reach the news feed: ${err.message}`), { code: 'NEWS_FETCH_FAILED' })
  }

  const cutoff = Date.now() - sinceDays * 86400_000
  const items = parseItems(xml)
    .map((it) => ({ ...it, ts: it.pubDate ? Date.parse(it.pubDate) : NaN }))
    .filter((it) => !Number.isNaN(it.ts) && it.ts >= cutoff)
    .sort((a, b) => b.ts - a.ts)
    .slice(0, limit)
    .map(({ title, source, link, pubDate, ts }) => ({
      title,
      source,
      url: link,
      date: new Date(ts).toISOString().slice(0, 10),
      pubDate,
    }))

  return items
}

/** Minimal, dependency-free RSS <item> parser. */
function parseItems(xml) {
  const out = []
  const blocks = xml.match(/<item>[\s\S]*?<\/item>/g) || []
  for (const block of blocks) {
    const rawTitle = tag(block, 'title')
    const link = tag(block, 'link')
    const pubDate = tag(block, 'pubDate')
    const source = tag(block, 'source') || sourceFromTitle(rawTitle)
    // Google News titles are "Headline - Source"; strip the trailing source.
    const title = source ? rawTitle.replace(new RegExp(`\\s*[-–—]\\s*${escapeRe(source)}\\s*$`), '').trim() : rawTitle
    if (title && link) out.push({ title, link, pubDate, source })
  }
  return out
}

function tag(block, name) {
  const m = block.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, 'i'))
  return m ? decode(m[1].replace(/<!\[CDATA\[|\]\]>/g, '').trim()) : ''
}

function sourceFromTitle(title) {
  const m = title.match(/\s[-–—]\s([^-–—]+)$/)
  return m ? m[1].trim() : ''
}

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

function decode(s) {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
}
