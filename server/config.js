import dotenv from 'dotenv'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

// Load server/.env first (co-located), then a root .env as fallback.
const here = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.join(here, '.env') })
dotenv.config({ path: path.join(here, '..', '.env') })

const list = (v, dflt) =>
  (v ?? dflt).split(',').map((s) => s.trim()).filter(Boolean)

/**
 * Central backend configuration. The tailoring agent routes work across models:
 * a cheap model does JD parsing + critique; a stronger one does the rewrite.
 */
export const config = {
  port: Number(process.env.PORT) || 8788,
  allowedOrigins: list(process.env.ALLOWED_ORIGINS, 'http://localhost:5173,http://localhost:5174'),

  // Firebase project — used to verify client ID tokens and (with credentials)
  // to read/write the quota docs via the Admin SDK.
  firebase: {
    projectId: process.env.FIREBASE_PROJECT_ID || 'resume-builder-501811',
    // Path to a service-account JSON. Optional: without it, ID-token
    // verification still works, but Admin Firestore quota is disabled.
    serviceAccountPath: process.env.GOOGLE_APPLICATION_CREDENTIALS || '',
    authDisabled: String(process.env.AUTH_DISABLED).toLowerCase() === 'true',
  },

  llm: {
    apiKey: process.env.GEMINI_API_KEY || '',
    // Task-routed models (quality where it matters, cheap elsewhere). Defaults
    // use the `-latest` aliases, which survive Google's model deprecations and
    // are available on the free tier. Pro models (gemini-2.5-pro, gemini-3.x-pro)
    // require a BILLING-ENABLED key — a free-tier key returns 429 for them.
    models: {
      tailor: process.env.GEMINI_TAILOR_MODEL || 'gemini-flash-latest',
      parse: process.env.GEMINI_PARSE_MODEL || 'gemini-flash-lite-latest',
      critique: process.env.GEMINI_CRITIQUE_MODEL || 'gemini-flash-lite-latest',
    },
    fallbackModels: list(process.env.GEMINI_FALLBACK_MODELS, 'gemini-flash-latest,gemini-flash-lite-latest'),
    temperature: Number(process.env.LLM_TEMPERATURE ?? 0.2),
    maxOutputTokens: Number(process.env.LLM_MAX_TOKENS ?? 8192),
    thinkingBudget: process.env.GEMINI_THINKING_BUDGET !== undefined ? Number(process.env.GEMINI_THINKING_BUDGET) : 0,
  },

  agent: {
    // Max improvement passes after critique/validation before returning best.
    maxImproveAttempts: Number(process.env.AGENT_MAX_IMPROVES ?? 2),
    // Rubric score (0–100) at/above which we stop improving early.
    targetScore: Number(process.env.AGENT_TARGET_SCORE ?? 85),
    skillsPolicy: process.env.INTEGRITY_SKILLS_POLICY || 'grounded',
  },
}

export function assertLlmConfigured() {
  if (!config.llm.apiKey) {
    throw Object.assign(new Error('Set GEMINI_API_KEY in server/.env'), { status: 503, code: 'LLM_NOT_CONFIGURED' })
  }
}
