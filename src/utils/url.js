/**
 * Only allow http(s) links to be rendered. Agent "sources" and news links come
 * from LLM grounding metadata / external RSS — untrusted — so a `javascript:` or
 * `data:` href could execute in the page. Returns a safe absolute URL, or null.
 */
export function safeUrl(url) {
  if (typeof url !== 'string' || !url.trim()) return null
  try {
    const u = new URL(url, typeof window !== 'undefined' ? window.location.origin : 'https://x')
    return u.protocol === 'http:' || u.protocol === 'https:' ? u.href : null
  } catch {
    return null
  }
}
