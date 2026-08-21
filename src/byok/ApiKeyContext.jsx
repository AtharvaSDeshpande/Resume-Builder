import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { useAuth } from '../auth/AuthContext.jsx'
import { agentApi } from '../services/agentApi.js'

/**
 * Tracks whether the signed-in user has linked their own Gemini API key (BYOK).
 * Drives the mandatory first-run setup gate and the Settings editor. The key
 * itself never lives here — only whether one exists and a masked hint.
 */
const ApiKeyContext = createContext(null)

export function ApiKeyProvider({ children }) {
  const { isAuthenticated } = useAuth()
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState({ available: true, hasKey: false, hint: null, updatedAt: null })

  const refresh = useCallback(async () => {
    try {
      setStatus(await agentApi.byokStatus())
    } catch {
      // If the status probe fails, don't hard-block the app on the gate.
      setStatus((s) => ({ ...s, available: false }))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!isAuthenticated) return
    setLoading(true)
    refresh()
  }, [isAuthenticated, refresh])

  const saveKey = useCallback(
    async (apiKey) => {
      const res = await agentApi.byokSave(apiKey)
      setStatus({ available: true, hasKey: true, hint: res.hint, updatedAt: res.updatedAt })
      return res
    },
    []
  )

  const removeKey = useCallback(async () => {
    await agentApi.byokRemove()
    setStatus({ available: true, hasKey: false, hint: null, updatedAt: null })
  }, [])

  const value = useMemo(
    () => ({ loading, ...status, needsSetup: status.available && !status.hasKey, refresh, saveKey, removeKey }),
    [loading, status, refresh, saveKey, removeKey]
  )

  return <ApiKeyContext.Provider value={value}>{children}</ApiKeyContext.Provider>
}

export function useApiKey() {
  const ctx = useContext(ApiKeyContext)
  if (!ctx) throw new Error('useApiKey must be used within <ApiKeyProvider>')
  return ctx
}
