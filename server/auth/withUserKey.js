import { getUserKey, byokAvailable } from '../services/userKeys.js'
import { runWithKey, getActiveUserKey } from '../llm/keyContext.js'

/**
 * Loads the signed-in user's decrypted Gemini key and runs the rest of the
 * request inside a key context, so the LLM client uses THEIR key (BYOK). Must
 * run after requireAuth. Best-effort: a missing/undecryptable key just leaves
 * the context empty — the endpoint's own guard decides whether that's fatal.
 */
export async function attachUserKey(req, res, next) {
  let key = null
  try {
    key = req.user ? await getUserKey(req.user.uid) : null
  } catch {
    key = null
  }
  req.hasUserKey = Boolean(key)
  runWithKey(key, req.user?.uid, () => next())
}

/**
 * Assert the current request can call Gemini. This is BYOK-only: the request
 * MUST carry the user's own decrypted key — there is no server key to fall back
 * to, so the owner is never billed for a user's usage.
 */
export function assertUserLlm() {
  if (getActiveUserKey()) return
  if (!byokAvailable()) {
    throw Object.assign(new Error('Key storage is not configured on the server.'), { status: 503, code: 'BYOK_UNAVAILABLE' })
  }
  throw Object.assign(new Error('Add your Gemini API key in Settings to use AI features.'), { status: 400, code: 'BYOK_REQUIRED' })
}
