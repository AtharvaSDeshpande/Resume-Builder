import { getFirestore } from '../auth/firebaseAdmin.js'
import { encryptSecret, decryptSecret, isEncryptionConfigured } from '../security/crypto.js'

/**
 * Per-user BYOK secret store. The user's own Gemini API key is encrypted
 * (AES-256-GCM) via the master key before being written, and only ever
 * decrypted server-side to make Gemini calls on their behalf. The client
 * receives only a masked hint (first/last 4 chars) — never the key back.
 *
 * Firestore docs live in `userSecrets/{uid}` and are readable ONLY through the
 * Admin SDK (firestore.rules denies all client access).
 */
const COLLECTION = 'userSecrets'

/** BYOK persistence needs both an admin DB and an encryption key configured. */
export const byokAvailable = () => Boolean(getFirestore()) && isEncryptionConfigured()

const hintOf = (key) => {
  const k = String(key || '')
  return k.length <= 8 ? '••••' : `${k.slice(0, 4)}…${k.slice(-4)}`
}

export async function saveUserKey(uid, apiKey) {
  const db = getFirestore()
  if (!db) throw Object.assign(new Error('Key storage is unavailable.'), { status: 503, code: 'BYOK_UNAVAILABLE' })
  await db.collection(COLLECTION).doc(uid).set(
    { provider: 'gemini', enc: encryptSecret(apiKey), hint: hintOf(apiKey), updatedAt: new Date().toISOString() },
    { merge: true }
  )
  return { hint: hintOf(apiKey) }
}

/** Decrypted plaintext key for a user (server-side use only), or null. */
export async function getUserKey(uid) {
  const db = getFirestore()
  if (!db) return null
  const snap = await db.collection(COLLECTION).doc(uid).get()
  return snap.exists ? decryptSecret(snap.data()?.enc) : null
}

/** Safe status for the client: does a key exist, and a masked hint — no secret. */
export async function getKeyStatus(uid) {
  const db = getFirestore()
  const available = byokAvailable()
  if (!db) return { available, hasKey: false, hint: null, updatedAt: null }
  const snap = await db.collection(COLLECTION).doc(uid).get()
  const d = snap.exists ? snap.data() : null
  return { available, hasKey: Boolean(d?.enc), hint: d?.hint || null, updatedAt: d?.updatedAt || null }
}

export async function deleteUserKey(uid) {
  const db = getFirestore()
  if (db) await db.collection(COLLECTION).doc(uid).delete()
}
