import express from 'express'
import cors from 'cors'
import { config, assertLlmConfigured } from './config.js'
import { initAdmin, isQuotaEnabled } from './auth/firebaseAdmin.js'
import { requireAuth } from './auth/requireAuth.js'
import { getQuota, reserveTailor, refundTailor } from './quota.js'
import { runTailorAgent } from './agent/tailorAgent.js'

initAdmin()

const app = express()
app.use(express.json({ limit: '1mb' }))
app.use(
  cors({
    origin(origin, cb) {
      if (!origin || config.allowedOrigins.includes(origin)) return cb(null, true)
      cb(new Error(`Origin ${origin} not allowed`))
    },
  })
)

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
    res.json(await getQuota(req.user.uid))
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// The tailoring agent. Pre-flight checks (LLM config, quota reservation) run
// synchronously so they can return a normal HTTP error. The agent itself then
// STREAMS its stage-by-stage progress over SSE, ending with the result — so the
// UI can show "what's happening" instead of one long spinner. Refunds on failure.
app.post('/api/tailor', requireAuth, async (req, res) => {
  const { baseResume, jobDescription } = req.body || {}

  let reserved = false
  try {
    assertLlmConfigured()
    if (!baseResume || !jobDescription) {
      throw Object.assign(new Error('A base résumé and job description are required.'), { status: 400, code: 'BAD_REQUEST' })
    }
    reserved = (await reserveTailor(req.user.uid)).enforced
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
    const result = await runTailorAgent({ baseResume, jobDescription, onProgress: (p) => send('progress', p) })
    const quota = await getQuota(req.user.uid)
    send('result', { ...result, quota })
    res.end()
  } catch (err) {
    if (reserved) await refundTailor(req.user.uid)
    if (!err.code) console.error('[tailor] error:', err)
    send('error', { error: err.message || 'Tailoring failed.', code: err.code })
    res.end()
  }
})

app.listen(config.port, () => {
  console.log(`\n  Résumé agent backend → http://localhost:${config.port}`)
  console.log(`  • llm  : ${config.llm.apiKey ? `tailor=${config.llm.models.tailor}` : 'NOT configured'}`)
  console.log(`  • auth : ${config.firebase.authDisabled ? 'DISABLED (dev)' : 'Firebase ID tokens'}`)
  console.log(`  • quota: ${isQuotaEnabled() ? 'enforced (Admin Firestore)' : 'NOT enforced (no creds)'}\n`)
})
