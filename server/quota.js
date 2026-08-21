import { getFirestore, isQuotaEnabled } from './auth/firebaseAdmin.js'

/**
 * Airtight, server-side daily quota — enforced separately for EVERY AI API.
 *
 * Each billable AI endpoint (tailor, score, and each career-prep agent) draws
 * from its OWN daily counter, so one feature can't exhaust another. The same
 * per-day max applies independently to each feature (raise it globally with
 * userLimits/{uid}.dailyLimit, or per-feature with userLimits/{uid}.dailyLimits).
 *
 * Because reserve/refund runs here via the Admin SDK, the client cannot bypass
 * it. Falls back to "not enforced" when Admin credentials aren't configured.
 *
 * Docs:
 *   usage/{uid}      = { uid, day: 'YYYY-MM-DD', counts: { <feature>: n } }
 *   userLimits/{uid} = { dailyLimit?, dailyTailorLimit?, dailyLimits?: {<feature>: n} }
 */

// Every AI API that consumes quota. Keep in sync with the endpoints in index.js.
export const FEATURES = ['tailor', 'score', 'companyIntel', 'placementBuddy', 'industryNews']

const DEFAULT_LIMIT = 1
const today = () => new Date().toISOString().slice(0, 10)

/** Per-feature daily cap: feature override → global override → legacy → default. */
async function limitFor(db, uid, feature) {
  const snap = await db.collection('userLimits').doc(uid).get()
  const d = snap.exists ? snap.data() || {} : {}
  const candidates = [d.dailyLimits?.[feature], d.dailyLimit, d.dailyTailorLimit]
  const n = candidates.find((v) => Number.isInteger(v) && v > 0)
  return n || DEFAULT_LIMIT
}

/** Read today's count for a feature from a usage doc (0 if stale/new day). */
function usedToday(data, feature) {
  if (!data || data.day !== today()) return 0
  return data.counts?.[feature] || 0
}

/** Quota state for a single feature. */
export async function getFeatureQuota(uid, feature) {
  const db = getFirestore()
  if (!isQuotaEnabled() || !db) return { enforced: false, used: 0, limit: DEFAULT_LIMIT, remaining: DEFAULT_LIMIT }
  const limit = await limitFor(db, uid, feature)
  const snap = await db.collection('usage').doc(uid).get()
  const used = usedToday(snap.exists ? snap.data() : null, feature)
  return { enforced: true, used, limit, remaining: Math.max(0, limit - used) }
}

/** Quota state for every feature at once (for GET /api/quota). */
export async function getAllQuota(uid) {
  const db = getFirestore()
  if (!isQuotaEnabled() || !db) {
    const features = Object.fromEntries(FEATURES.map((f) => [f, { used: 0, limit: DEFAULT_LIMIT, remaining: DEFAULT_LIMIT }]))
    return { enforced: false, day: today(), features }
  }
  const snap = await db.collection('usage').doc(uid).get()
  const data = snap.exists ? snap.data() : null
  const features = {}
  for (const f of FEATURES) {
    const limit = await limitFor(db, uid, f)
    const used = usedToday(data, f)
    features[f] = { used, limit, remaining: Math.max(0, limit - used) }
  }
  return { enforced: true, day: today(), features }
}

/** Atomically reserve one use of `feature` today; throws QUOTA_EXCEEDED if none left. */
export async function reserve(uid, feature) {
  const db = getFirestore()
  if (!isQuotaEnabled() || !db) return { enforced: false }
  const ref = db.collection('usage').doc(uid)
  const limit = await limitFor(db, uid, feature)
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref)
    const data = snap.exists ? snap.data() : null
    const freshDay = !data || data.day !== today()
    const used = usedToday(data, feature)
    if (used >= limit) {
      throw Object.assign(new Error(`Daily limit reached for ${feature} (${limit}/day). Try again tomorrow.`), {
        status: 429,
        code: 'QUOTA_EXCEEDED',
      })
    }
    // On a new day, reset ALL counters; otherwise bump just this feature.
    const counts = freshDay ? { [feature]: 1 } : { ...(data.counts || {}), [feature]: used + 1 }
    tx.set(ref, { uid, day: today(), counts }, { merge: !freshDay })
    return { enforced: true, used: used + 1, limit, remaining: limit - used - 1 }
  })
}

/** Give a reservation back when the AI call itself failed. */
export async function refund(uid, feature) {
  const db = getFirestore()
  if (!isQuotaEnabled() || !db) return
  const ref = db.collection('usage').doc(uid)
  try {
    await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref)
      if (!snap.exists) return
      const data = snap.data()
      if (data.day !== today()) return
      const cur = data.counts?.[feature] || 0
      tx.set(ref, { counts: { ...(data.counts || {}), [feature]: Math.max(0, cur - 1) } }, { merge: true })
    })
  } catch {
    /* best-effort */
  }
}
