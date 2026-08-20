import { getGenerativeModel } from 'firebase/ai'
import { jsonrepair } from 'jsonrepair'
import { ai } from '../firebase.js'
import { aiConfig } from './config.js'

/**
 * Gemini access via Firebase AI Logic (no server, no exposed key).
 *
 * Robustness layers carried over from the old backend:
 *   • model fallback chain on rate-limit (429) / overload (503),
 *   • thinking-token control (gated to 2.5/3.x models),
 *   • tolerant JSON parsing (jsonrepair), and
 *   • truncation (MAX_TOKENS) detection.
 */
const MAX_TRANSIENT_RETRIES = 2

// Gemini 2.5 and 3.x are "thinking" models; 2.0 / 1.5 reject thinkingConfig.
const supportsThinking = (m) => /^gemini-(2\.5|3(\.\d+)?)/.test(m)

let lastUsedModel = aiConfig.model

/** The model that actually served the most recent successful call. */
export const usedModel = () => `gemini:${lastUsedModel}`

/**
 * @param {{ system: string, messages: {role:'user'|'model', text:string}[] }} params
 * @returns {Promise<object>} parsed JSON
 */
export async function generateJSON({ system, messages }) {
  const contents = messages.map((m) => ({
    role: m.role === 'model' ? 'model' : 'user',
    parts: [{ text: m.text }],
  }))
  return runModelChain({ system, contents })
}

/**
 * Multimodal variant — pass raw `parts` (text + inlineData, e.g. a PDF) as a
 * single user turn. Used for PDF → JSON resume extraction.
 * @param {{ system: string, parts: Array<object> }} params
 */
export async function generateJSONFromParts({ system, parts }) {
  return runModelChain({ system, contents: [{ role: 'user', parts }] })
}

/** Shared model-fallback + parse loop for both text and multimodal calls. */
async function runModelChain({ system, contents }) {
  // Prefer the last working model so repeat calls skip an already-dead primary.
  const chain = [lastUsedModel, ...[aiConfig.model, ...aiConfig.fallbackModels].filter((m) => m !== lastUsedModel)]

  let lastSaturation = null
  for (const modelName of chain) {
    try {
      const response = await withRetry(() => callModel(modelName, system, contents))
      const finish = response.candidates?.[0]?.finishReason
      if (finish === 'MAX_TOKENS') {
        throw tagged('The model hit the output token limit — raise VITE_LLM_MAX_TOKENS.', 'LLM_TRUNCATED')
      }
      lastUsedModel = modelName
      return safeParseJson(response.text())
    } catch (err) {
      if (classifySaturation(err)) {
        lastSaturation = err
        continue
      }
      throw err
    }
  }

  const is429 = classifySaturation(lastSaturation) === 429
  throw tagged(
    is429
      ? `All Gemini models are rate-limited/quota-exceeded (tried: ${chain.join(', ')}). Check your quota, or wait for it to reset.`
      : `All Gemini models are temporarily overloaded (tried: ${chain.join(', ')}). Please try again shortly.`,
    is429 ? 'LLM_RATE_LIMITED' : 'LLM_OVERLOADED'
  )
}

function callModel(modelName, system, contents) {
  const generationConfig = {
    temperature: aiConfig.temperature,
    maxOutputTokens: aiConfig.maxOutputTokens,
    responseMimeType: 'application/json',
  }
  const budget = aiConfig.thinkingBudget
  if (supportsThinking(modelName) && Number.isFinite(budget) && budget >= 0) {
    generationConfig.thinkingConfig = { thinkingBudget: budget }
  }
  const model = getGenerativeModel(ai, { model: modelName, systemInstruction: system, generationConfig })
  return model.generateContent({ contents }).then((r) => r.response)
}

async function withRetry(fn) {
  let attempt = 0
  for (;;) {
    try {
      return await fn()
    } catch (err) {
      const sat = classifySaturation(err)
      if (!sat || attempt >= MAX_TRANSIENT_RETRIES) throw err
      attempt += 1
      await sleep(500 * 2 ** (attempt - 1))
    }
  }
}

/** Returns 429 (rate-limit/quota), 503 (overload), or null. */
function classifySaturation(err) {
  if (!err) return null
  const blob = `${err.message || ''} ${err.code || ''} ${err.customErrorData?.status || ''} ${err.customErrorData?.httpStatus || ''}`.toLowerCase()
  if (/\b429\b|resource_exhausted|quota|rate.?limit/.test(blob)) return 429
  if (/\b503\b|unavailable|overloaded|high demand/.test(blob)) return 503
  const st = err.customErrorData?.httpStatus ?? err.status
  if (st === 429) return 429
  if (st === 503) return 503
  return null
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const tagged = (message, code) => Object.assign(new Error(message), { code })

/**
 * Parse model output into JSON, tolerating the imperfect JSON models sometimes
 * emit. Tries the outermost {...} slice then the whole string; plain parse then
 * repaired parse for each.
 */
export function safeParseJson(text) {
  if (!text || !text.trim()) throw tagged('Empty AI response.', 'LLM_EMPTY')
  let cleaned = text.trim()
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim()
  }
  const start = cleaned.indexOf('{')
  const end = cleaned.lastIndexOf('}')
  const slice = start !== -1 && end > start ? cleaned.slice(start, end + 1) : null
  for (const candidate of [slice, cleaned].filter(Boolean)) {
    try {
      return JSON.parse(candidate)
    } catch {
      /* try repair */
    }
    try {
      return JSON.parse(jsonrepair(candidate))
    } catch {
      /* next */
    }
  }
  throw tagged('The AI did not return parseable JSON.', 'LLM_BAD_JSON')
}
