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
    // Dev-only auth bypass. Hard-refused in production so a stray env var can
    // never open every endpoint to anonymous callers.
    authDisabled:
      String(process.env.AUTH_DISABLED).toLowerCase() === 'true' && process.env.NODE_ENV !== 'production',
  },

  llm: {
    // BYOK only: every Gemini call uses the signed-in user's own key (resolved
    // per-request from their encrypted secret). There is NO server-held API key.
    //
    // `preferredModels` is tried best-first per request: a Pro model is used when
    // the user's key can access it, otherwise it falls back to Flash. These are
    // model NAMES only (not keys).
    models: {
      // Cheap models for the auxiliary stages (JD parse, critique/scoring).
      parse: process.env.GEMINI_PARSE_MODEL || 'gemini-flash-lite-latest',
      critique: process.env.GEMINI_CRITIQUE_MODEL || 'gemini-flash-lite-latest',
    },
    preferredModels: list(process.env.GEMINI_PREFERRED_MODELS, 'gemini-2.5-pro,gemini-flash-latest,gemini-flash-lite-latest'),
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
