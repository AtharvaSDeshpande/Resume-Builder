import { AsyncLocalStorage } from 'node:async_hooks'

/**
 * Request-scoped Gemini context (BYOK). The auth middleware decrypts the signed-
 * in user's own key and runs the rest of the request inside this store, so the
 * Gemini client (llm/gemini.js) can pick up the key — and cache the best model
 * per user — without threading them through every agent function.
 */
export const keyStore = new AsyncLocalStorage()

export const runWithKey = (key, uid, fn) => keyStore.run({ key: key || null, uid: uid || null }, fn)

export const getActiveUserKey = () => keyStore.getStore()?.key || null

export const getActiveUid = () => keyStore.getStore()?.uid || null
