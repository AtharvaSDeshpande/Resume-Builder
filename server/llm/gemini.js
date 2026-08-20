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
 * @param {{ model: string, system?: string, prompt: string,
 *           temperature?: number, maxOutputTokens?: number }} args
 * @returns {Promise<{ data: object, modelUsed: string }>}
 */
export async function generateJSON({ model, system, prompt, temperature, maxOutputTokens }) {
  const chain = [...new Set([model, ...config.llm.fallbackModels])]
  let lastSaturation = null

  for (const modelName of chain) {
    try {
      const text = await withRetry(() => callModel({ modelName, system, prompt, temperature, maxOutputTokens }))
      return { data: safeParseJson(text), modelUsed: modelName }
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

async function callModel({ modelName, system, prompt, temperature, maxOutputTokens }) {
  const generationConfig = {
    temperature: temperature ?? config.llm.temperature,
    maxOutputTokens: maxOutputTokens ?? config.llm.maxOutputTokens,
    responseMimeType: 'application/json',
  }
  // Thinking control — only Gemini 2.5 (non-pro) accepts an explicit budget.
  // Other models (3.x, pro) manage thinking themselves; maxOutputTokens gives
  // them room. This avoids the 400 that 3.x flash returns for thinkingBudget 0.
  const budget = config.llm.thinkingBudget
  if (acceptsThinkingBudget(modelName) && Number.isFinite(budget) && budget >= 0) {
    generationConfig.thinkingConfig = { thinkingBudget: budget }
  }
  const gm = client.getGenerativeModel({ model: modelName, systemInstruction: system, generationConfig })
  const res = await gm.generateContent(prompt)
  const finish = res.response.candidates?.[0]?.finishReason
  if (finish === 'MAX_TOKENS') {
    throw Object.assign(new Error('Output token limit hit — raise LLM_MAX_TOKENS.'), { code: 'LLM_TRUNCATED', status: 502 })
  }
  return res.response.text()
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
