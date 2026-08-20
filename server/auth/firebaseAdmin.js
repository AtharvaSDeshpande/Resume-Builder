import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import admin from 'firebase-admin'
import { config } from '../config.js'

const serverDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')

/** Resolve the credentials path: absolute as-is, else relative to server/. */
function resolveServiceAccount(p) {
  if (!p) return ''
  const candidates = [p, path.resolve(serverDir, p)]
  return candidates.find((c) => fs.existsSync(c) && fs.statSync(c).isFile()) || ''
}

/**
 * Firebase Admin bootstrap.
 *
 * - ID-token verification works with just the project id (Google public certs),
 *   so auth is available even without a service account.
 * - Admin Firestore (for airtight server-side quota) needs credentials
 *   (GOOGLE_APPLICATION_CREDENTIALS → a service-account JSON). Without them the
 *   quota gracefully degrades to "not enforced" and logs a warning once.
 */
let app = null
let firestore = null
let quotaEnabled = false

export function initAdmin() {
  if (app) return
  const projectId = config.firebase.projectId
  const configured = config.firebase.serviceAccountPath
  const saPath = resolveServiceAccount(configured)

  // Misconfigured value (e.g. an OAuth client id pasted instead of a file path,
  // or a file that doesn't exist): disable quota gracefully and keep the SDK
  // from trying to read it. Auth (ID-token verification) still works.
  if (configured && !saPath) {
    console.warn(
      `[admin] GOOGLE_APPLICATION_CREDENTIALS="${String(configured).slice(0, 28)}…" is not a readable file. ` +
        'It must be the path to a service-account .json (absolute, or relative to server/). Quota disabled.'
    )
    delete process.env.GOOGLE_APPLICATION_CREDENTIALS
  }

  if (saPath) {
    try {
      const sa = JSON.parse(fs.readFileSync(saPath, 'utf8'))
      app = admin.initializeApp({ credential: admin.credential.cert(sa), projectId: sa.project_id || projectId })
      firestore = admin.firestore(app)
      quotaEnabled = true
      console.log(`[admin] service account loaded (${path.basename(saPath)}) — quota enforced.`)
    } catch (e) {
      console.warn('[admin] service account invalid, quota disabled:', e.message)
      app = admin.initializeApp({ projectId }, 'nocreds')
    }
  } else {
    app = admin.initializeApp({ projectId })
    console.warn('[admin] no valid service account — server-side quota disabled (auth still works).')
  }
}

export const getFirestore = () => firestore
export const isQuotaEnabled = () => quotaEnabled

export async function verifyIdToken(idToken) {
  initAdmin()
  return admin.auth().verifyIdToken(idToken)
}
