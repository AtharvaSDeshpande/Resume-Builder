import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import admin from 'firebase-admin'
import { config } from '../config.js'

const serverDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')

/** Resolve a credentials file path: absolute as-is, else relative to server/. */
function resolveServiceAccount(p) {
  if (!p) return ''
  const candidates = [p, path.resolve(serverDir, p)]
  return candidates.find((c) => fs.existsSync(c) && fs.statSync(c).isFile()) || ''
}

/**
 * Load a service-account object from (in order):
 *   1. FIREBASE_SERVICE_ACCOUNT_BASE64 — base64 of the JSON (best for PaaS envs)
 *   2. FIREBASE_SERVICE_ACCOUNT        — the raw JSON string
 *   3. GOOGLE_APPLICATION_CREDENTIALS  — a path to the JSON file (local dev)
 * Returns null if none is present/valid. Never logs the key material.
 */
function loadServiceAccount() {
  const b64 = (process.env.FIREBASE_SERVICE_ACCOUNT_BASE64 || '').trim()
  const rawEnv = (process.env.FIREBASE_SERVICE_ACCOUNT || '').trim()
  const raw = b64 ? safeFromBase64(b64) : rawEnv
  if (raw) {
    try {
      return JSON.parse(raw)
    } catch {
      console.warn('[admin] FIREBASE_SERVICE_ACCOUNT is set but is not valid JSON — ignoring.')
    }
  }
  const saPath = resolveServiceAccount(config.firebase.serviceAccountPath)
  if (config.firebase.serviceAccountPath && !saPath) {
    console.warn(
      `[admin] GOOGLE_APPLICATION_CREDENTIALS="${String(config.firebase.serviceAccountPath).slice(0, 24)}…" is not a readable file. ` +
        'Provide the service account via FIREBASE_SERVICE_ACCOUNT_BASE64 (recommended in prod) or a valid file path.'
    )
  }
  if (saPath) {
    try {
      return JSON.parse(fs.readFileSync(saPath, 'utf8'))
    } catch (e) {
      console.warn('[admin] service-account file is unreadable/invalid:', e.message)
    }
  }
  return null
}

function safeFromBase64(b64) {
  try {
    return Buffer.from(b64, 'base64').toString('utf8')
  } catch {
    return ''
  }
}

/**
 * Firebase Admin bootstrap.
 *
 * - ID-token verification works with just the project id (Google public certs),
 *   so auth is available even without credentials.
 * - Admin Firestore (server-side quota + BYOK key storage) needs credentials:
 *   an explicit service account (env or file), or Application Default
 *   Credentials on Google-hosted runtimes (Cloud Run / App Engine / GCE).
 *   Without any, those features degrade off (and a warning is logged once).
 */
let app = null
let firestore = null
let quotaEnabled = false

export function initAdmin() {
  if (app) return
  const projectId = config.firebase.projectId
  const sa = loadServiceAccount()

  if (sa) {
    app = admin.initializeApp({ credential: admin.credential.cert(sa), projectId: sa.project_id || projectId })
    firestore = admin.firestore(app)
    quotaEnabled = true
    console.log('[admin] service account loaded — Firestore (quota + BYOK) enabled.')
    return
  }

  // No explicit key: use Application Default Credentials ONLY on Google-hosted
  // runtimes (Cloud Run / App Engine / Functions / GCE), where ADC actually
  // exists. Enabling it elsewhere would fail lazily at the first Firestore call.
  const onGoogle = Boolean(
    process.env.K_SERVICE || process.env.GAE_ENV || process.env.FUNCTION_TARGET || process.env.GOOGLE_CLOUD_PROJECT
  )
  if (onGoogle) {
    try {
      app = admin.initializeApp({ credential: admin.credential.applicationDefault(), projectId })
      firestore = admin.firestore(app)
      quotaEnabled = true
      console.log('[admin] using Application Default Credentials — Firestore (quota + BYOK) enabled.')
      return
    } catch (e) {
      console.warn('[admin] Application Default Credentials unavailable:', e.message)
    }
  }

  app = admin.initializeApp({ projectId })
  console.warn(
    '[admin] no credentials found — server-side quota and BYOK key storage are DISABLED (auth still works). ' +
      'Set FIREBASE_SERVICE_ACCOUNT_BASE64 (and BYOK_ENC_KEY) in the environment to enable them.'
  )
}

export const getFirestore = () => firestore
export const isQuotaEnabled = () => quotaEnabled

export async function verifyIdToken(idToken) {
  initAdmin()
  return admin.auth().verifyIdToken(idToken)
}
