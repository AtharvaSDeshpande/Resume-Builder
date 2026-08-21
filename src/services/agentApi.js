import { auth } from '../firebase.js'

/**
 * Client for the Express tailoring-agent backend. Attaches the current user's
 * Firebase ID token so the server can verify identity and enforce the quota.
 */
async function authFetch(path, opts = {}) {
  const user = auth.currentUser
  const token = user ? await user.getIdToken() : null
  const res = await fetch(path, {
    ...opts,
    headers: {
      ...(opts.body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(opts.headers || {}),
    },
  })
  const data = await res.json().catch(() => null)
  if (!res.ok) {
    const err = new Error(data?.error || `Request failed (${res.status})`)
    err.code = data?.code
    err.status = res.status
    throw err
  }
  return data
}

export const agentApi = {
  health: () => authFetch('/api/health'),
  quota: () => authFetch('/api/quota'),
  tailor: (body, onProgress) => streamTailor(body, onProgress),
  // Standalone JD-fit score (critique only) — no tailoring, no quota.
  score: (body) => authFetch('/api/score', { method: 'POST', body: JSON.stringify(body) }),
  // Run a career-prep agent (company intel / placement buddy / industry news).
  runAgent: (id, body) => authFetch(`/api/agents/${id}`, { method: 'POST', body: JSON.stringify(body) }),

  // BYOK — the user's own Gemini API key (stored encrypted server-side).
  byokStatus: () => authFetch('/api/byok'),
  byokSave: (apiKey) => authFetch('/api/byok', { method: 'POST', body: JSON.stringify({ apiKey }) }),
  byokRemove: () => authFetch('/api/byok', { method: 'DELETE' }),
}

/**
 * Calls the streaming tailor endpoint. Pre-flight errors arrive as a normal JSON
 * error; once the SSE stream starts, `onProgress(stage)` fires per agent stage
 * and the final `result` event resolves the promise.
 */
async function streamTailor(body, onProgress) {
  const user = auth.currentUser
  const token = user ? await user.getIdToken() : null
  const res = await fetch('/api/tailor', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  })

  // Pre-stream failure (quota, no key, bad request) → JSON error, not a stream.
  if (!res.ok || !res.body) {
    const data = await res.json().catch(() => null)
    const err = new Error(data?.error || `Request failed (${res.status})`)
    err.code = data?.code
    err.status = res.status
    throw err
  }

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let result = null
  let streamError = null

  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    let sep
    while ((sep = buffer.indexOf('\n\n')) !== -1) {
      const evt = parseSse(buffer.slice(0, sep))
      buffer = buffer.slice(sep + 2)
      if (!evt) continue
      if (evt.event === 'progress') onProgress?.(evt.data)
      else if (evt.event === 'result') result = evt.data
      else if (evt.event === 'error') streamError = evt.data
    }
  }

  if (streamError) {
    const err = new Error(streamError.error || 'Tailoring failed.')
    err.code = streamError.code
    throw err
  }
  if (!result) throw new Error('The tailoring stream ended without a result.')
  return result
}

function parseSse(raw) {
  let event = 'message'
  let data = ''
  for (const line of raw.split('\n')) {
    if (line.startsWith('event:')) event = line.slice(6).trim()
    else if (line.startsWith('data:')) data += line.slice(5).trim()
  }
  if (!data) return null
  try {
    return { event, data: JSON.parse(data) }
  } catch {
    return null
  }
}
