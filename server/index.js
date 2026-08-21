import express from 'express'
import cors from 'cors'
import path from 'path'
import { fileURLToPath } from 'url'
import { config, assertLlmConfigured } from './config.js'
import { initAdmin, isQuotaEnabled } from './auth/firebaseAdmin.js'
import { requireAuth } from './auth/requireAuth.js'
import { getAllQuota, reserve, refund } from './quota.js'
import { runTailorAgent } from './agent/tailorAgent.js'
import { critiqueResume } from './agent/critique.js'
import { runAgent, isAgent, AGENTS } from './agents/index.js'

initAdmin()

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const app = express()
app.use(express.json({ limit: '1mb' }))

// In production, when frontend and backend share the same origin, 
// allow same-origin requests while preserving your existing CORS checks.
app.use(
  cors({
    origin(origin, cb) {
      if (!origin || config.allowedOrigins.includes(origin)) return cb(null, true)
      cb(new Error(`Origin ${origin} not allowed`))
    },
  })
)

// =======================
// API Routes
// =======================

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    llmConfigured: Boolean(config.llm.apiKey),
    quotaEnforced: isQuotaEnabled(),
    authRequired: !config.firebase.authDisabled,
    models: config.llm.models,
  })
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

app.post('/api/agents/:id', requireAuth, async (req, res) => {
  const id = req.params.id
  let reserved = false
  try {
    assertLlmConfigured()
    if (!isAgent(id)) return res.status(404).json({ error: 'Unknown agent.', code: 'UNKNOWN_AGENT' })
    reserved = (await reserve(req.user.uid, id)).enforced // per-agent daily quota
    const result = await runAgent(id, req.body || {})
    res.json({ ...result, quota: await getAllQuota(req.user.uid) })
  } catch (err) {
    if (reserved) await refund(req.user.uid, id)
    if (err.status >= 500 && !err.code) console.error(`[agent:${id}] error:`, err)
    res.status(err.status || 500).json({ error: err.message || 'Agent failed.', code: err.code })
  }
})

// Standalone JD-fit scoring — critique only (one cheap call), no tailoring and
// no quota. Lets the UI re-check a résumé's fit score on demand.
app.post('/api/score', requireAuth, async (req, res) => {
  let reserved = false
  try {
    assertLlmConfigured()
    const { profile, jobDescription } = req.body || {}
    if (!profile || !jobDescription) {
      return res.status(400).json({ error: 'A résumé profile and job description are required.', code: 'BAD_REQUEST' })
    }
    reserved = (await reserve(req.user.uid, 'score')).enforced // per-API daily quota
    const { score, jdCoverage, weaknesses } = await critiqueResume({ profile, jobDescription })
    res.json({ score, jdCoverage, weaknesses, quota: await getAllQuota(req.user.uid) })
  } catch (err) {
    if (reserved) await refund(req.user.uid, 'score')
    res.status(err.status || 500).json({ error: err.message || 'Scoring failed.', code: err.code })
  }
})

// The tailoring agent SSE endpoint
app.post('/api/tailor', requireAuth, async (req, res) => {
  const { baseResume, jobDescription, additionalContext } = req.body || {}

  let reserved = false
  try {
    assertLlmConfigured()
    if (!baseResume || !jobDescription) {
      throw Object.assign(new Error('A base résumé and job description are required.'), { status: 400, code: 'BAD_REQUEST' })
    }
    reserved = (await reserve(req.user.uid, 'tailor')).enforced
  } catch (err) {
    return res.status(err.status || 500).json({ error: err.message || 'Tailoring failed.', code: err.code })
  }

  // Begin the event stream.
  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache, no-transform')
  res.setHeader('Connection', 'keep-alive')
  res.flushHeaders?.()
  const send = (event, data) => res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)

  try {
    const result = await runTailorAgent({ baseResume, jobDescription, additionalContext, onProgress: (p) => send('progress', p) })
    const quota = await getAllQuota(req.user.uid)
    send('result', { ...result, quota })
    res.end()
  } catch (err) {
    if (reserved) await refund(req.user.uid, 'tailor')
    if (!err.code) console.error('[tailor] error:', err)
    send('error', { error: err.message || 'Tailoring failed.', code: err.code })
    res.end()
  }
})

// =======================
// Static Build & SPA Fallback
// =======================

// Resolves to the 'dist' directory located in the project root
const distPath = path.resolve(__dirname, '../dist')

// Serve static assets generated by Vite
app.use(express.static(distPath))

// Single Page Application (SPA) catch-all: send index.html for any non-API route
app.get('*', (req, res) => {
  res.sendFile(path.join(distPath, 'index.html'))
})

app.listen(config.port, () => {
  console.log(`\n  Résumé agent backend → http://localhost:${config.port}`)
  console.log(`  • llm  : ${config.llm.apiKey ? `tailor=${config.llm.models.tailor}` : 'NOT configured'}`)
  console.log(`  • auth : ${config.firebase.authDisabled ? 'DISABLED (dev)' : 'Firebase ID tokens'}`)
  console.log(`  • quota: ${isQuotaEnabled() ? 'enforced (Admin Firestore)' : 'NOT enforced (no creds)'}\n`)
})