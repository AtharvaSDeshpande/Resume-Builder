import React, { createContext, useCallback, useContext, useMemo, useState } from 'react'

/**
 * App-wide single-flight lock for AI actions. Only one AI task (tailor, score,
 * or any agent) may run at a time per user — so every trigger disables while one
 * is active, mirroring the server-side AI_BUSY guard. Wrap an AI call in `run`;
 * read `busy` to disable buttons.
 */
const AiActivityContext = createContext(null)

export function AiActivityProvider({ children }) {
  const [busy, setBusy] = useState(false)

  const run = useCallback(
    async (fn) => {
      if (busy) throw Object.assign(new Error('Another AI task is already running.'), { code: 'AI_BUSY' })
      setBusy(true)
      try {
        return await fn()
      } finally {
        setBusy(false)
      }
    },
    [busy]
  )

  const value = useMemo(() => ({ busy, run }), [busy, run])
  return <AiActivityContext.Provider value={value}>{children}</AiActivityContext.Provider>
}

export function useAiActivity() {
  const ctx = useContext(AiActivityContext)
  if (!ctx) throw new Error('useAiActivity must be used within <AiActivityProvider>')
  return ctx
}
