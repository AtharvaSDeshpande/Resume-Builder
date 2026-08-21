import crypto from 'node:crypto'

/**
 * Authenticated symmetric encryption for user secrets (BYOK Gemini keys).
 *
 * We encrypt each key with AES-256-GCM before it ever touches the database, so
 * the stored value is useless without the server's master key (BYOK_ENC_KEY,
 * held only in the server environment, never in the DB or the browser). GCM also
 * authenticates the ciphertext, so tampering is detected on decrypt.
 *
 * BYOK_ENC_KEY must be 32 bytes, provided as 64 hex chars or base64. Generate:
 *   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
 */
function masterKey() {
  const raw = (process.env.BYOK_ENC_KEY || '').trim()
  if (!raw) return null
  const buf = /^[0-9a-fA-F]{64}$/.test(raw) ? Buffer.from(raw, 'hex') : Buffer.from(raw, 'base64')
  return buf.length === 32 ? buf : null
}

export const isEncryptionConfigured = () => Boolean(masterKey())

/** Encrypt a plaintext secret → a portable, storable envelope. */
export function encryptSecret(plaintext) {
  const key = masterKey()
  if (!key) throw Object.assign(new Error('Server encryption key (BYOK_ENC_KEY) is not configured.'), { status: 503, code: 'ENC_NOT_CONFIGURED' })
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv)
  const ct = Buffer.concat([cipher.update(String(plaintext), 'utf8'), cipher.final()])
  return { v: 1, alg: 'aes-256-gcm', ct: ct.toString('base64'), iv: iv.toString('base64'), tag: cipher.getAuthTag().toString('base64') }
}

/** Decrypt an envelope back to plaintext, or null if missing/invalid/tampered. */
export function decryptSecret(enc) {
  const key = masterKey()
  if (!key || !enc?.ct || !enc?.iv || !enc?.tag) return null
  try {
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(enc.iv, 'base64'))
    decipher.setAuthTag(Buffer.from(enc.tag, 'base64'))
    return Buffer.concat([decipher.update(Buffer.from(enc.ct, 'base64')), decipher.final()]).toString('utf8')
  } catch {
    return null
  }
}
