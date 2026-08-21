import { config } from '../config.js'
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
  runWithKey(key, () => next())
}

/**
 * Assert the current request can call Gemini. When BYOK is available, the user
 * MUST have set their own key (we never silently fall back to the server key and
 * bill the owner). In dev without BYOK, the server key is allowed.
 */
export function assertUserLlm() {
  if (getActiveUserKey()) return
  if (byokAvailable()) {
    throw Object.assign(new Error('Add your Gemini API key in Settings to use AI features.'), { status: 400, code: 'BYOK_REQUIRED' })
  }
  if (!config.llm.apiKey) {
    throw Object.assign(new Error('No Gemini API key configured.'), { status: 503, code: 'LLM_NOT_CONFIGURED' })
  }
}
