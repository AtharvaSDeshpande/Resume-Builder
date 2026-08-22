import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { encryptSecret, decryptSecret, isEncryptionConfigured } from '../../server/security/crypto.js'

// A deterministic 32-byte key (64 hex chars) for the test process.
const TEST_KEY = 'a'.repeat(64)

describe('security/crypto (AES-256-GCM)', () => {
  let prev
  beforeAll(() => {
    prev = process.env.BYOK_ENC_KEY
    process.env.BYOK_ENC_KEY = TEST_KEY
  })
  afterAll(() => {
    process.env.BYOK_ENC_KEY = prev
  })

  it('reports configured when a valid key is present', () => {
    expect(isEncryptionConfigured()).toBe(true)
  })

  it('round-trips plaintext through encrypt/decrypt', () => {
    const secret = 'AIzaSy-super-secret-gemini-key-123'
    const env = encryptSecret(secret)
    expect(env).toMatchObject({ v: 1, alg: 'aes-256-gcm' })
    expect(env.ct).toEqual(expect.any(String))
    expect(env.ct).not.toContain(secret) // stored form is opaque
    expect(decryptSecret(env)).toBe(secret)
  })

  it('produces a unique IV per encryption (no deterministic ciphertext)', () => {
    const a = encryptSecret('same')
    const b = encryptSecret('same')
    expect(a.iv).not.toBe(b.iv)
    expect(a.ct).not.toBe(b.ct)
  })

  it('returns null for tampered ciphertext (GCM auth fails)', () => {
    const env = encryptSecret('tamper-me')
    const tampered = { ...env, ct: Buffer.from('deadbeef', 'hex').toString('base64') }
    expect(decryptSecret(tampered)).toBeNull()
  })

  it('returns null for a malformed envelope', () => {
    expect(decryptSecret(null)).toBeNull()
    expect(decryptSecret({})).toBeNull()
  })

  it('throws when no master key is configured', () => {
    const saved = process.env.BYOK_ENC_KEY
    delete process.env.BYOK_ENC_KEY
    try {
      expect(isEncryptionConfigured()).toBe(false)
      expect(() => encryptSecret('x')).toThrow(/BYOK_ENC_KEY/)
    } finally {
      process.env.BYOK_ENC_KEY = saved
    }
  })
})
