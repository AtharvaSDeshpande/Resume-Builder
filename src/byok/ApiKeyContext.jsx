import React, { createContext, useContext, useMemo } from 'react'
import { useAuth } from '../auth/AuthContext.jsx'
import { useByokStatus, useSaveByok, useRemoveByok } from '../queries/backend.js'

/**
 * Whether the signed-in user has linked their own Gemini API key (BYOK), backed
 * by React Query. Drives the mandatory first-run setup gate and the Settings
 * editor. The key itself never lives here — only whether one exists + a masked
 * hint. Kept as a context so the same cached status is shared app-wide.
 */
const ApiKeyContext = createContext(null)

const EMPTY = { available: true, hasKey: false, hint: null, updatedAt: null }

export function ApiKeyProvider({ children }) {
  const { isAuthenticated } = useAuth()
  const { data, isLoading } = useByokStatus(isAuthenticated)
  const save = useSaveByok()
  const remove = useRemoveByok()

  const status = data || EMPTY

  const value = useMemo(
    () => ({
      loading: isAuthenticated ? isLoading : false,
      ...status,
      needsSetup: status.available && !status.hasKey,
      saveKey: (apiKey) => save.mutateAsync(apiKey),
      removeKey: () => remove.mutateAsync(),
    }),
    [isAuthenticated, isLoading, status, save, remove]
  )

  return <ApiKeyContext.Provider value={value}>{children}</ApiKeyContext.Provider>
}

export function useApiKey() {
  const ctx = useContext(ApiKeyContext)
  if (!ctx) throw new Error('useApiKey must be used within <ApiKeyProvider>')
  return ctx
}
