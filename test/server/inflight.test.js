import { describe, it, expect } from 'vitest'
import { acquire, release, isBusy } from '../../server/agent/inflight.js'

describe('agent/inflight (per-user single-flight)', () => {
  it('allows one task, blocks a concurrent one, then frees the slot', () => {
    const uid = 'u-inflight'
    expect(isBusy(uid)).toBe(false)

    acquire(uid)
    expect(isBusy(uid)).toBe(true)
    expect(() => acquire(uid)).toThrowError(expect.objectContaining({ code: 'AI_BUSY', status: 409 }))

    release(uid)
    expect(isBusy(uid)).toBe(false)
    expect(() => acquire(uid)).not.toThrow() // reusable after release
    release(uid)
  })

  it('tracks users independently', () => {
    acquire('a')
    expect(() => acquire('b')).not.toThrow()
    release('a')
    release('b')
  })
})
