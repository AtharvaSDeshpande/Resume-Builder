/** Friendly label for a Gemini model id, e.g. "gemini-2.5-pro" → "Gemini 2.5 Pro". */
export function prettyModel(id = '') {
  if (!id) return ''
  const m = id.replace(/^gemini-/, '').replace(/-latest$/, '')
  const tier = /pro/.test(m) ? 'Pro' : /lite/.test(m) ? 'Flash-Lite' : /flash/.test(m) ? 'Flash' : ''
  const ver = (m.match(/^(\d+(?:\.\d+)?)/) || [])[1]
  return ['Gemini', ver, tier].filter(Boolean).join(' ') || id
}
