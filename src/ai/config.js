// Client-side AI settings. Overridable via Vite env (VITE_*) for easy tuning
// without code changes; sensible defaults otherwise.
export const aiConfig = {
  model: import.meta.env.VITE_GEMINI_MODEL || 'gemini-3.5-flash',
  // On rate-limit (429) / overload (503) the client falls through these in order.
  fallbackModels: (import.meta.env.VITE_GEMINI_FALLBACK_MODELS ??
    'gemini-2.5-flash-lite,gemini-2.0-flash')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
  temperature: Number(import.meta.env.VITE_LLM_TEMPERATURE ?? 0.2),
  maxOutputTokens: Number(import.meta.env.VITE_LLM_MAX_TOKENS ?? 8192),
  // Gemini 2.5/3.x "thinking" tokens count against maxOutputTokens; 0 = off.
  thinkingBudget:
    import.meta.env.VITE_GEMINI_THINKING_BUDGET !== undefined
      ? Number(import.meta.env.VITE_GEMINI_THINKING_BUDGET)
      : 0,
  maxRepairAttempts: Number(import.meta.env.VITE_LLM_MAX_REPAIRS ?? 2),
  // Skills freedom: 'subset' | 'grounded' | 'open' (see integrityGuards.js).
  skillsPolicy: import.meta.env.VITE_INTEGRITY_SKILLS_POLICY || 'grounded',
}
