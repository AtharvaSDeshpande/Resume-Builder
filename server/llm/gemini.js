import { GoogleGenerativeAI } from '@google/generative-ai'
import { jsonrepair } from 'jsonrepair'
import { config } from '../config.js'

/**
 * Thin Gemini client for the agent. Each call names the model to use (task
 * routing happens in the agent), with a shared fallback chain on rate-limit /
 * overload, thinking-token control, and tolerant JSON parsing.
 */
const client = new GoogleGenerativeAI(config.llm.apiKey || 'missing')

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
    res = await client.getGenerativeModel(modelParams).generateContent(prompt)
  } catch (err) {
    // Grounding unavailable for this key/model → retry once without the tool so
    // the agent still returns an (ungrounded) answer instead of failing.
    if (useSearch && isToolError(err)) {
      const fallbackCfg = { ...generationConfig, responseMimeType: 'application/json' }
      res = await client.getGenerativeModel({ model: modelName, systemInstruction: system, generationConfig: fallbackCfg }).generateContent(prompt)
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
