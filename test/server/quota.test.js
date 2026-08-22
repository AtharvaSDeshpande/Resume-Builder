import { describe, it, expect, beforeEach, vi } from 'vitest'

/**
 * In-memory fake Firestore that supports the surface quota.js uses:
 * collection().doc().get()/set(), and runTransaction with get/set.
 */
function makeDb(seed = {}) {
  const store = { ...seed } // "collection/id" -> data
  const ref = (coll, id) => {
    const key = `${coll}/${id}`
    return {
      key,
      get: async () => ({ exists: key in store, data: () => store[key] }),
      set: async (data, opts) => {
        store[key] = opts?.merge ? { ...(store[key] || {}), ...data } : data
      },
    }
  }
  return {
    store,
    collection: (coll) => ({ doc: (id) => ref(coll, id) }),
    runTransaction: async (fn) =>
      fn({
        get: (r) => r.get(),
        set: (r, data, opts) => r.set(data, opts),
      }),
  }
}

const state = vi.hoisted(() => ({ db: null, enabled: true }))
vi.mock('../../server/auth/firebaseAdmin.js', () => ({
  getFirestore: () => state.db,
  isQuotaEnabled: () => state.enabled,
}))

import { reserve, refund, getFeatureQuota, getAllQuota, FEATURES } from '../../server/quota.js'

const UID = 'user-1'

describe('quota (per-API daily limits)', () => {
  beforeEach(() => {
    state.db = makeDb()
    state.enabled = true
  })

  it('reserves against a per-feature counter (default limit 1)', async () => {
    const r = await reserve(UID, 'tailor')
    expect(r).toMatchObject({ enforced: true, used: 1, remaining: 0 })
    const q = await getFeatureQuota(UID, 'tailor')
    expect(q).toMatchObject({ used: 1, limit: 1, remaining: 0 })
  })

  it('throws QUOTA_EXCEEDED past the limit', async () => {
    await reserve(UID, 'tailor')
    await expect(reserve(UID, 'tailor')).rejects.toMatchObject({ code: 'QUOTA_EXCEEDED', status: 429 })
  })

  it('keeps each AI feature on its own counter', async () => {
    await reserve(UID, 'tailor')
    // score is a different feature — still allowed even though tailor is used up.
    const r = await reserve(UID, 'score')
    expect(r.used).toBe(1)
    const all = await getAllQuota(UID)
    expect(all.features.tailor.used).toBe(1)
    expect(all.features.score.used).toBe(1)
    expect(all.features.companyIntel.used).toBe(0)
  })

  it('refunds a reservation', async () => {
    await reserve(UID, 'tailor')
    await refund(UID, 'tailor')
    const q = await getFeatureQuota(UID, 'tailor')
    expect(q.used).toBe(0)
  })

  it('honours a raised per-user limit', async () => {
    state.db = makeDb({ 'userLimits/user-1': { dailyLimit: 3 } })
    await reserve(UID, 'tailor')
    await reserve(UID, 'tailor')
    const r = await reserve(UID, 'tailor')
    expect(r).toMatchObject({ used: 3, remaining: 0 })
    await expect(reserve(UID, 'tailor')).rejects.toMatchObject({ code: 'QUOTA_EXCEEDED' })
  })

  it('resets counters on a new day', async () => {
    state.db = makeDb({ 'usage/user-1': { uid: UID, day: '2000-01-01', counts: { tailor: 9 } } })
    const r = await reserve(UID, 'tailor')
    expect(r.used).toBe(1) // stale day wiped
  })

  it('degrades to not-enforced without admin creds', async () => {
    state.enabled = false
    const r = await reserve(UID, 'tailor')
    expect(r).toEqual({ enforced: false })
    const all = await getAllQuota(UID)
    expect(all.enforced).toBe(false)
  })

  it('exposes the full feature list', () => {
    expect(FEATURES).toEqual(expect.arrayContaining(['tailor', 'score', 'companyIntel', 'placementBuddy', 'industryNews']))
  })
})
