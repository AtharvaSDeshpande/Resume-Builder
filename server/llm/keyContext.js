import { AsyncLocalStorage } from 'node:async_hooks'

/**
 * Request-scoped Gemini API key (BYOK). The auth middleware decrypts the signed-
 * in user's own key and runs the rest of the request inside this store, so the
 * Gemini client (llm/gemini.js) can pick it up without threading the key through
 * every agent function. Falls back to the server key only when BYOK isn't set up.
 */
export const keyStore = new AsyncLocalStorage()

export const runWithKey = (key, fn) => keyStore.run({ key: key || null }, fn)

export const getActiveUserKey = () => keyStore.getStore()?.key || null
