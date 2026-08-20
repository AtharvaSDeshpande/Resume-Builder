import { config } from '../config.js'
import { verifyIdToken } from './firebaseAdmin.js'

/**
 * Requires a Firebase ID token in `Authorization: Bearer <token>` and attaches
 * `req.user = { uid, email, name }`. AUTH_DISABLED=true injects a dev stub.
 */
export async function requireAuth(req, res, next) {
  if (config.firebase.authDisabled) {
    req.user = { uid: 'dev-user', email: 'dev@local', name: 'Dev User' }
    return next()
  }
  const header = req.headers.authorization || ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : null
  if (!token) return res.status(401).json({ error: 'Sign in to continue.', code: 'NO_TOKEN' })
  try {
    const decoded = await verifyIdToken(token)
    req.user = { uid: decoded.uid, email: decoded.email, name: decoded.name }
    next()
  } catch (err) {
    res.status(401).json({ error: 'Authentication failed.', code: 'AUTH_FAILED', detail: err.message })
  }
}
