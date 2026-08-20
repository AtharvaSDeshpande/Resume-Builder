import { getFirestore, isQuotaEnabled } from './auth/firebaseAdmin.js'

/**
 * Airtight, server-side daily tailor quota.
 *
 * Because the reserve/refund runs here (Admin SDK), the client cannot bypass it
 * — unlike the previous client-only counter. Falls back to "not enforced" when
 * Admin Firestore credentials aren't configured (dev), so the server still runs.
 *
 * Docs: usage/{uid} = { uid, count, day }, userLimits/{uid} = { dailyTailorLimit }.
 */
const DEFAULT_LIMIT = 1
const today = () => new Date().toISOString().slice(0, 10)

async function limitFor(db, uid) {
  const snap = await db.collection('userLimits').doc(uid).get()
  const n = snap.exists ? snap.data()?.dailyTailorLimit : undefined
  return Number.isInteger(n) && n > 0 ? n : DEFAULT_LIMIT
}

export async function getQuota(uid) {
  const db = getFirestore()
  if (!isQuotaEnabled() || !db) return { enforced: false, used: 0, limit: DEFAULT_LIMIT, remaining: DEFAULT_LIMIT }
  const limit = await limitFor(db, uid)
  const snap = await db.collection('usage').doc(uid).get()
  const data = snap.exists ? snap.data() : null
  const used = data && data.day === today() ? data.count || 0 : 0
  return { enforced: true, used, limit, remaining: Math.max(0, limit - used) }
}

/** Atomically reserve one tailor for today; throws QUOTA_EXCEEDED if none left. */
export async function reserveTailor(uid) {
  const db = getFirestore()
  if (!isQuotaEnabled() || !db) return { enforced: false }
  const ref = db.collection('usage').doc(uid)
  const limit = await limitFor(db, uid)
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref)
    const data = snap.exists ? snap.data() : null
    const used = data && data.day === today() ? data.count || 0 : 0
    if (used >= limit) {
      throw Object.assign(new Error(`Daily limit reached (${limit}/day). Try again tomorrow.`), {
        status: 429,
        code: 'QUOTA_EXCEEDED',
      })
    }
    tx.set(ref, { uid, count: used + 1, day: today() }, { merge: true })
    return { enforced: true, used: used + 1, limit, remaining: limit - used - 1 }
  })
}

/** Give a reservation back when the tailor call itself failed. */
export async function refundTailor(uid) {
  const db = getFirestore()
  if (!isQuotaEnabled() || !db) return
  const ref = db.collection('usage').doc(uid)
  try {
    await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref)
      if (!snap.exists) return
      const data = snap.data()
      if (data.day !== today()) return
      tx.update(ref, { count: Math.max(0, (data.count || 0) - 1) })
    })
  } catch {
    /* best-effort */
  }
}
