import { describe, it, expect, vi, afterEach } from 'vitest'
import { fetchRecentNews } from '../../server/tools/news.js'

const iso = (daysAgo) => new Date(Date.now() - daysAgo * 86400_000).toUTCString()

const xml = `<?xml version="1.0"?><rss><channel>
  <item>
    <title>Acme raises $50M Series B - TechCrunch</title>
    <link>https://example.com/acme-b</link>
    <pubDate>${iso(1)}</pubDate>
    <source url="https://techcrunch.com">TechCrunch</source>
  </item>
  <item>
    <title>Old news from last month - Reuters</title>
    <link>https://example.com/old</link>
    <pubDate>${iso(30)}</pubDate>
    <source url="https://reuters.com">Reuters</source>
  </item>
</channel></rss>`

afterEach(() => vi.restoreAllMocks())

describe('tools/news (Google News RSS)', () => {
  it('parses recent items, strips the source suffix, and keeps real dates/urls', async () => {
    global.fetch = vi.fn(async () => ({ ok: true, text: async () => xml }))
    const items = await fetchRecentNews({ query: 'Acme', sinceDays: 7 })

    expect(global.fetch).toHaveBeenCalledOnce()
    const calledUrl = global.fetch.mock.calls[0][0]
    expect(calledUrl).toContain('news.google.com/rss/search')
    expect(calledUrl).toContain(encodeURIComponent('Acme when:7d'))

    expect(items).toHaveLength(1) // the 30-day-old item is filtered out
    expect(items[0]).toMatchObject({
      title: 'Acme raises $50M Series B', // " - TechCrunch" stripped
      source: 'TechCrunch',
      url: 'https://example.com/acme-b',
    })
    expect(items[0].date).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('throws a tagged error when the feed is unreachable', async () => {
    global.fetch = vi.fn(async () => ({ ok: false, status: 503 }))
    await expect(fetchRecentNews({ query: 'x' })).rejects.toMatchObject({ code: 'NEWS_FETCH_FAILED' })
  })
})
