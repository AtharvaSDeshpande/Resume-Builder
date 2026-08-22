import express from 'express'
import cors from 'cors'
import compression from 'compression'
import path from 'path'
import { fileURLToPath } from 'url'
import { config } from './config.js'
import { initAdmin, isQuotaEnabled } from './auth/firebaseAdmin.js'
import { requireAuth } from './auth/requireAuth.js'
import { attachUserKey, assertUserLlm } from './auth/withUserKey.js'
import { getAllQuota, reserve, refund } from './quota.js'
import { acquire, release } from './agent/inflight.js'
import { runTailorAgent } from './agent/tailorAgent.js'
import { critiqueResume } from './agent/critique.js'
import { runAgent, isAgent, AGENTS } from './agents/index.js'
import { validateApiKey, clearBestModel } from './llm/gemini.js'
import { saveUserKey, getKeyStatus, deleteUserKey, byokAvailable } from './services/userKeys.js'

initAdmin()

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const app = express()
app.disable('x-powered-by')
app.use(compression()) // gzip JSON/JS/CSS responses
app.use(express.json({ limit: '1mb' }))

// Minimal security headers (no extra deps). The SPA is served from this origin.
app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('X-Frame-Options', 'SAMEORIGIN')
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin')
  next()
})

// CORS: allow same-origin (no Origin header) and configured origins. Unknown
// cross-origins simply get NO CORS headers (browser blocks the response) rather
// than a thrown 500 — so same-origin API calls in prod never break on this.
app.use(
  cors({
    origin(origin, cb) {
      cb(null, !origin || config.allowedOrigins.includes(origin))
    },
  })
)

// =======================
// API Routes
// =======================

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    byok: byokAvailable(),
    quotaEnforced: isQuotaEnabled(),
    authRequired: !config.firebase.authDisabled,
    models: config.llm.models,
  })
})

// ---- BYOK: the user's own Gemini API key (encrypted at rest) --------------

// Whether the user has a key set (masked hint only — the secret is never
// returned). Drives the mandatory first-run setup screen.
app.get('/api/byok', requireAuth, async (req, res) => {
  try {
    res.json(await getKeyStatus(req.user.uid))
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// Set / replace the user's key. We validate it live, then store it encrypted.
app.post('/api/byok', requireAuth, async (req, res) => {
  try {
    if (!byokAvailable()) {
      return res.status(503).json({ error: 'Key storage is not configured on the server.', code: 'BYOK_UNAVAILABLE' })
    }
    const apiKey = String(req.body?.apiKey || '').trim()
    if (!apiKey) return res.status(400).json({ error: 'Paste your Gemini API key.', code: 'BAD_REQUEST' })
    if (apiKey.length > 200) return res.status(400).json({ error: "That doesn't look like a valid API key.", code: 'BAD_REQUEST' })
    await validateApiKey(apiKey) // throws BYOK_INVALID if Google rejects it
    await saveUserKey(req.user.uid, apiKey)
    clearBestModel(req.user.uid) // new key may unlock/lose Pro — re-probe next run
    res.json({ ok: true, ...(await getKeyStatus(req.user.uid)) })
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message || 'Could not save the key.', code: err.code })
  }
})

// Remove the stored key (user is signing out of BYOK / switching accounts).
app.delete('/api/byok', requireAuth, async (req, res) => {
  try {
    await deleteUserKey(req.user.uid)
    clearBestModel(req.user.uid)
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

app.get('/api/quota', requireAuth, async (req, res) => {
  try {
    res.json(await getAllQuota(req.user.uid))
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// Career-prep agents (company intel, placement buddy, industry news). Each runs
// its own workflow; each draws from its OWN daily quota (see POST below).
app.get('/api/agents', requireAuth, (_req, res) => {
  res.json({ agents: Object.values(AGENTS).map((a) => ({ id: a.id, label: a.label, agentic: Boolean(a.agentic) })) })
})

app.post('/api/agents/:id', requireAuth, attachUserKey, async (req, res) => {
  const id = req.params.id
  const uid = req.user.uid
  let reserved = false
  let locked = false
  try {
    assertUserLlm()
    if (!isAgent(id)) return res.status(404).json({ error: 'Unknown agent.', code: 'UNKNOWN_AGENT' })
    acquire(uid); locked = true // block concurrent AI triggers for this user
    reserved = (await reserve(uid, id)).enforced // per-agent daily quota
    const result = await runAgent(id, req.body || {})
    res.json({ ...result, quota: await getAllQuota(uid) })
  } catch (err) {
    if (reserved) await refund(uid, id)
    if (err.status >= 500 && !err.code) console.error(`[agent:${id}] error:`, err)
    res.status(err.status || 500).json({ error: err.message || 'Agent failed.', code: err.code })
  } finally {
    if (locked) release(uid)
  }
})

// Standalone JD-fit scoring — critique only (one cheap call), no tailoring and
// no quota. Lets the UI re-check a résumé's fit score on demand.
app.post('/api/score', requireAuth, attachUserKey, async (req, res) => {
  const uid = req.user.uid
  let reserved = false
  let locked = false
  try {
    assertUserLlm()
    const { profile, jobDescription } = req.body || {}
    if (!profile || !jobDescription) {
      return res.status(400).json({ error: 'A résumé profile and job description are required.', code: 'BAD_REQUEST' })
    }
    acquire(uid); locked = true
    reserved = (await reserve(uid, 'score')).enforced // per-API daily quota
    const { score, jdCoverage, weaknesses } = await critiqueResume({ profile, jobDescription })
    res.json({ score, jdCoverage, weaknesses, quota: await getAllQuota(uid) })
  } catch (err) {
    if (reserved) await refund(uid, 'score')
    res.status(err.status || 500).json({ error: err.message || 'Scoring failed.', code: err.code })
  } finally {
    if (locked) release(uid)
  }
})

// The tailoring agent SSE endpoint
app.post('/api/tailor', requireAuth, attachUserKey, async (req, res) => {
  const { baseResume, jobDescription, additionalContext } = req.body || {}
  const uid = req.user.uid

  let reserved = false
  let locked = false
  try {
    assertUserLlm()
    if (!baseResume || !jobDescription) {
      throw Object.assign(new Error('A base résumé and job description are required.'), { status: 400, code: 'BAD_REQUEST' })
    }
    acquire(uid); locked = true // block concurrent AI triggers for this user
    reserved = (await reserve(uid, 'tailor')).enforced
  } catch (err) {
    if (locked) release(uid)
    return res.status(err.status || 500).json({ error: err.message || 'Tailoring failed.', code: err.code })
  }

  // Release the single-flight slot no matter how the stream ends (incl. client disconnect).
  const done = () => { if (locked) { release(uid); locked = false } }
  res.on('close', done)

  // Begin the event stream.
  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache, no-transform')
  res.setHeader('Connection', 'keep-alive')
  res.flushHeaders?.()
  const send = (event, data) => res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)

  try {
    const result = await runTailorAgent({ baseResume, jobDescription, additionalContext, onProgress: (p) => send('progress', p) })
    const quota = await getAllQuota(uid)
    send('result', { ...result, quota })
    res.end()
  } catch (err) {
    if (reserved) await refund(uid, 'tailor')
    if (!err.code) console.error('[tailor] error:', err)
    send('error', { error: err.message || 'Tailoring failed.', code: err.code })
    res.end()
  } finally {
    done()
  }
})

// =======================
// Static Build & SPA Fallback
// =======================

// Resolves to the 'dist' directory located in the project root
const distPath = path.resolve(__dirname, '../dist')

// Serve Vite assets. Files under /assets are content-hashed, so cache them hard;
// everything else (incl. index.html) is validated so new deploys are picked up.
app.use(
  express.static(distPath, {
    setHeaders(res, filePath) {
      if (filePath.includes(`${path.sep}assets${path.sep}`)) {
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable')
      } else {
        res.setHeader('Cache-Control', 'no-cache')
      }
    },
  })
)

// SPA catch-all: the HTML shell must never be cached, so a deploy is seen at once.
app.get('*', (_req, res) => {
  res.setHeader('Cache-Control', 'no-cache')
  res.sendFile(path.join(distPath, 'index.html'))
})

app.listen(config.port, () => {
  console.log(`\n  Résumé agent backend → http://localhost:${config.port}`)
  console.log(`  • llm  : BYOK (per-user key) · prefers ${config.llm.preferredModels[0]}`)
  console.log(`  • auth : ${config.firebase.authDisabled ? 'DISABLED (dev)' : 'Firebase ID tokens'}`)
  console.log(`  • quota: ${isQuotaEnabled() ? 'enforced (Admin Firestore)' : 'NOT enforced (no creds)'}`)
  console.log(`  • byok : ${byokAvailable() ? 'enabled (users bring their own key, encrypted)' : 'disabled (needs admin creds + BYOK_ENC_KEY)'}\n`)
})