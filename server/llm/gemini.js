import { GoogleGenerativeAI } from '@google/generative-ai'
import { jsonrepair } from 'jsonrepair'
import { config } from '../config.js'
import { getActiveUserKey, getActiveUid, keyStore } from './keyContext.js'

/**
 * Thin Gemini client for the agent. Each call names the model to use (task
 * routing happens in the agent), with a shared fallback chain on rate-limit /
 * overload, thinking-token control, and tolerant JSON parsing.
 *
 * BYOK: the client is built per call from the request-scoped user key (their own
 * Gemini key, so quota/billing is theirs), falling back to the server key only
 * when BYOK isn't configured.
 */
const getClient = () => {
  const key = getActiveUserKey()
  if (!key) throw Object.assign(new Error('No API key for this request.'), { status: 400, code: 'BYOK_REQUIRED' })
  return new GoogleGenerativeAI(key)
}

/** Does the current request carry the user's own key? */
export const hasUsableKey = () => Boolean(getActiveUserKey())

/** Friendly label for a Gemini model id, e.g. "gemini-2.5-pro" → "Gemini 2.5 Pro". */
export function prettyModel(id = '') {
  if (!id) return ''
  const m = id.replace(/^gemini-/, '').replace(/-latest$/, '')
  const tier = /pro/.test(m) ? 'Pro' : /lite/.test(m) ? 'Flash-Lite' : /flash/.test(m) ? 'Flash' : ''
  const ver = (m.match(/^(\d+(?:\.\d+)?)/) || [])[1]
  if (!tier && !ver) return id // unknown id → show as-is, not a bare "Gemini"
  return ['Gemini', ver, tier].filter(Boolean).join(' ')
}

/**
 * Pick the BEST model the user's key can actually use, trying `candidates`
 * best-first (Pro before Flash) with a tiny probe call. The result is cached on
 * the request's key context so every stage of a run reuses the same model
 * without re-probing. Falls back to the last candidate if none probe cleanly.
 */
// Best-model probe is cached per user for an hour, so we don't re-probe Pro
// availability on every AI call (saves a round-trip per run). Also cached on the
// request store for reuse across stages within one run.
const BEST_MODEL_TTL_MS = 60 * 60_000
const bestModelByUid = new Map() // uid -> { model, at }

export async function resolveBestModel(candidates = config.llm.preferredModels) {
  const store = keyStore.getStore()
  if (store?.bestModel) return store.bestModel

  const uid = getActiveUid()
  if (uid) {
    const hit = bestModelByUid.get(uid)
    if (hit && Date.now() - hit.at < BEST_MODEL_TTL_MS) {
      if (store) store.bestModel = hit.model
      return hit.model
    }
  }

  let chosen = candidates[candidates.length - 1]
  for (const m of candidates) {
    try {
      await getClient().getGenerativeModel({ model: m }).generateContent({
        contents: [{ role: 'user', parts: [{ text: 'hi' }] }],
        generationConfig: { maxOutputTokens: 1 },
      })
      chosen = m
      break
    } catch (err) {
      if (isKeyError(err)) throw keyErr()
      // 429/permission/unknown-model on this key → not usable, try the next.
    }
  }
  if (store) store.bestModel = chosen
  if (uid) bestModelByUid.set(uid, { model: chosen, at: Date.now() })
  return chosen
}

/** Clear a user's cached best-model (call when their key changes). */
export const clearBestModel = (uid) => bestModelByUid.delete(uid)

/** A rejected/invalid API key (as opposed to a rate-limit or overload). */
const isKeyError = (err) => {
  const blob = `${err?.status || ''} ${err?.message || ''}`.toLowerCase()
  return /api key not valid|api_key_invalid|invalid api key|permission denied|api key expired|\b401\b|\b403\b/.test(blob)
}

const keyErr = () =>
  Object.assign(new Error('Your Gemini API key was rejected. Update it in Settings.'), { status: 400, code: 'BYOK_INVALID' })

/**
 * Validate a candidate API key with a minimal live call, before we store it.
 * Returns true if the key works (a rate-limit still counts as "valid").
 */
export async function validateApiKey(apiKey) {
  try {
    const model = new GoogleGenerativeAI(apiKey).getGenerativeModel({ model: config.llm.models.parse })
    await model.generateContent({ contents: [{ role: 'user', parts: [{ text: 'ping' }] }], generationConfig: { maxOutputTokens: 1 } })
    return true
  } catch (err) {
    if (classifySaturation(err) === 429) return true // key is valid, just rate-limited
    if (isKeyError(err)) throw keyErr()
    throw Object.assign(new Error(`Could not validate the key: ${err?.message || 'unknown error'}`), { status: 400, code: 'BYOK_INVALID' })
  }
}

const RETRY = new Set([500, 502, 503, 504])
// Only Gemini 2.5 reliably accepts an explicit thinkingBudget (incl. 0 to
// disable). 3.x models reject budget 0 → 400, and Pro can't disable at all, so
// we simply don't send thinkingConfig for them and let them use their default.
const acceptsThinkingBudget = (m) => /^gemini-2\.5/.test(m) && !m.includes('-pro')
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

/**
 * @param {{ model: string, system?: string, prompt: string, temperature?: number,
 *           maxOutputTokens?: number, useSearch?: boolean }} args
 * @returns {Promise<{ data: object, modelUsed: string, sources: {title,url}[], grounded: boolean }>}
 *
 * `useSearch` enables Google Search grounding (for agents that need current/web
 * info). Grounded calls can't use JSON response-mode, so we parse tolerantly and
 * return any cited sources. If grounding isn't available for the key/model, the
 * call gracefully degrades to the model's own knowledge.
 */
export async function generateJSON({ model, system, prompt, temperature, maxOutputTokens, useSearch = false }) {
  try {
    return await runChain({ model, system, prompt, temperature, maxOutputTokens, useSearch })
  } catch (err) {
    // Grounding often has a separate (sometimes zero) free-tier quota. If a
    // grounded call is rate-limited or unsupported, fall back to the model's own
    // knowledge so the agent still returns useful (if less current) insight.
    if (useSearch && (classifySaturation(err) || isToolError(err))) {
      return runChain({ model, system, prompt, temperature, maxOutputTokens, useSearch: false })
    }
    throw err
  }
}

/**
 * A genuine tool-using agent loop (ReAct-style function calling). Unlike
 * `generateJSON` — one prompt in, one JSON out — here the MODEL decides which
 * tools to call, with what arguments, in what order, and WHEN it has gathered
 * enough to finish. That model-directed control flow + dynamic stopping is what
 * makes this an agent rather than a fixed prompt/workflow.
 *
 * @param {{
 *   model: string, system: string, prompt: string, temperature?: number,
 *   maxSteps?: number,
 *   tools: Record<string, { declaration: object, handler: (args:object)=>Promise<{result:any, sources?:{title,url}[], summary?:string}> }>,
 *   onStep?: (step: {tool:string, args:object, summary?:string}) => void,
 * }} args
 * @returns {Promise<{ data: object, steps: object[], sources: {title,url}[], modelUsed: string }>}
 */
export async function runToolAgent({ model, system, prompt, temperature, maxSteps = 6, tools, onStep = () => {} }) {
  const functionDeclarations = Object.values(tools).map((t) => t.declaration)
  const genModel = getClient().getGenerativeModel({
    model,
    systemInstruction: system,
    tools: [{ functionDeclarations }],
    generationConfig: { temperature: temperature ?? config.llm.temperature, maxOutputTokens: config.llm.maxOutputTokens },
  })
  const chat = genModel.startChat()

  const steps = []
  const sources = []
  let message = prompt

  for (let step = 0; step < maxSteps; step += 1) {
    let res
    try {
      res = await withRetry(() => chat.sendMessage(message))
    } catch (err) {
      if (isKeyError(err)) throw keyErr()
      throw err
    }
    const calls = res.response.functionCalls?.() || []

    if (!calls.length) {
      // No tool call → the agent is done and returned its final answer.
      return { data: safeParseJson(res.response.text()), steps, sources, modelUsed: model }
    }

    // Execute every requested tool and feed the results back for the next turn.
    const responses = []
    for (const call of calls) {
      const tool = tools[call.name]
      let payload
      if (!tool) {
        payload = { error: `Unknown tool "${call.name}".` }
      } else {
        try {
          const out = await tool.handler(call.args || {})
          payload = out?.result ?? out ?? {}
          if (Array.isArray(out?.sources)) for (const s of out.sources) if (!sources.some((x) => x.url === s.url)) sources.push(s)
          const trace = { tool: call.name, args: call.args || {}, summary: out?.summary }
          steps.push(trace)
          onStep(trace)
        } catch (err) {
          payload = { error: err?.message || 'Tool failed.' }
          steps.push({ tool: call.name, args: call.args || {}, summary: `error: ${payload.error}` })
        }
      }
      responses.push({ functionResponse: { name: call.name, response: { data: payload } } })
    }
    message = responses
  }

  // Ran out of steps — ask the model to synthesise a final answer from what it has.
  const closing = await withRetry(() =>
    chat.sendMessage('You have gathered enough. Respond NOW with the final JSON object only — no more tool calls.')
  )
  return { data: safeParseJson(closing.response.text()), steps, sources, modelUsed: model }
}

async function runChain({ model, system, prompt, temperature, maxOutputTokens, useSearch }) {
  const chain = [...new Set([model, ...config.llm.fallbackModels])]
  let lastSaturation = null

  for (const modelName of chain) {
    try {
      const { text, sources, grounded } = await withRetry(() =>
        callModel({ modelName, system, prompt, temperature, maxOutputTokens, useSearch })
      )
      return { data: safeParseJson(text), modelUsed: modelName, sources, grounded }
    } catch (err) {
      if (isKeyError(err)) throw keyErr()
      if (classifySaturation(err)) {
        lastSaturation = err
        continue
      }
      throw err
    }
  }
  const is429 = classifySaturation(lastSaturation) === 429
  throw Object.assign(
    new Error(
      is429
        ? 'Gemini quota/rate limit reached across all models. Try again later or raise your quota.'
        : 'Gemini is temporarily overloaded. Please try again shortly.'
    ),
    { status: is429 ? 429 : 503, code: is429 ? 'LLM_RATE_LIMITED' : 'LLM_OVERLOADED' }
  )
}

async function callModel({ modelName, system, prompt, temperature, maxOutputTokens, useSearch }) {
  const generationConfig = {
    temperature: temperature ?? config.llm.temperature,
    maxOutputTokens: maxOutputTokens ?? config.llm.maxOutputTokens,
  }
  // JSON response-mode conflicts with the search tool, so only use it ungrounded.
  if (!useSearch) generationConfig.responseMimeType = 'application/json'

  const budget = config.llm.thinkingBudget
  if (acceptsThinkingBudget(modelName) && Number.isFinite(budget) && budget >= 0) {
    generationConfig.thinkingConfig = { thinkingBudget: budget }
  }

  const modelParams = { model: modelName, systemInstruction: system, generationConfig }
  if (useSearch) modelParams.tools = [{ googleSearch: {} }]

  let res
  try {
    res = await getClient().getGenerativeModel(modelParams).generateContent(prompt)
  } catch (err) {
    // Grounding unavailable for this key/model → retry once without the tool so
    // the agent still returns an (ungrounded) answer instead of failing.
    if (useSearch && isToolError(err)) {
      const fallbackCfg = { ...generationConfig, responseMimeType: 'application/json' }
      res = await getClient().getGenerativeModel({ model: modelName, systemInstruction: system, generationConfig: fallbackCfg }).generateContent(prompt)
      return { text: res.response.text(), sources: [], grounded: false }
    }
    throw err
  }

  const finish = res.response.candidates?.[0]?.finishReason
  if (finish === 'MAX_TOKENS') {
    throw Object.assign(new Error('Output token limit hit — raise LLM_MAX_TOKENS.'), { code: 'LLM_TRUNCATED', status: 502 })
  }
  return { text: res.response.text(), sources: extractSources(res.response), grounded: useSearch }
}

const isToolError = (err) => {
  const s = `${err?.status || ''} ${err?.message || ''}`.toLowerCase()
  return err?.status === 400 || /tool|search|not supported|invalid argument/.test(s)
}

/** Pull unique {title,url} from grounding metadata (search-cited sources). */
function extractSources(response) {
  const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || []
  const seen = new Set()
  const out = []
  for (const c of chunks) {
    const url = c?.web?.uri
    if (!url || seen.has(url)) continue
    seen.add(url)
    out.push({ title: c.web.title || url, url })
  }
  return out
}

async function withRetry(fn, max = 2) {
  let attempt = 0
  for (;;) {
    try {
      return await fn()
    } catch (err) {
      const s = err?.status
      const retriable = RETRY.has(s) || s === 429
      if (!retriable || attempt >= max) throw err
      attempt += 1
      await sleep(500 * 2 ** (attempt - 1))
    }
  }
}

function classifySaturation(err) {
  if (!err) return null
  const s = err.status
  if (s === 429) return 429
  if (s === 503) return 503
  const blob = `${err.message || ''}`.toLowerCase()
  if (/\b429\b|resource_exhausted|quota|rate.?limit/.test(blob)) return 429
  if (/\b503\b|unavailable|overloaded/.test(blob)) return 503
  return null
}

export function safeParseJson(text) {
  if (!text || !text.trim()) throw Object.assign(new Error('Empty AI response.'), { code: 'LLM_EMPTY' })
  let cleaned = text.trim()
  if (cleaned.startsWith('```')) cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim()
  const start = cleaned.indexOf('{')
  const end = cleaned.lastIndexOf('}')
  const slice = start !== -1 && end > start ? cleaned.slice(start, end + 1) : null
  for (const c of [slice, cleaned].filter(Boolean)) {
    try {
      return JSON.parse(c)
    } catch {
      /* try repair */
    }
    try {
      return JSON.parse(jsonrepair(c))
    } catch {
      /* next */
    }
  }
  throw Object.assign(new Error('AI did not return parseable JSON.'), { code: 'LLM_BAD_JSON', status: 502 })
}
