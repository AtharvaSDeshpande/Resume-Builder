import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { agentApi } from '../services/agentApi.js'
import { qk } from './queryClient.js'

/* ----------------------------------------------------------------- BYOK key */

export function useByokStatus(enabled = true) {
  return useQuery({
    queryKey: qk.byok,
    queryFn: agentApi.byokStatus,
    enabled,
    staleTime: 5 * 60_000,
  })
}

export function useSaveByok() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (apiKey) => agentApi.byokSave(apiKey),
    onSuccess: (data) => qc.setQueryData(qk.byok, data),
  })
}

export function useRemoveByok() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => agentApi.byokRemove(),
    onSuccess: () => qc.setQueryData(qk.byok, { available: true, hasKey: false, hint: null, updatedAt: null }),
  })
}

/* -------------------------------------------------------------------- quota */

export function useQuota(enabled = true) {
  return useQuery({ queryKey: qk.quota, queryFn: agentApi.quota, enabled, staleTime: 30_000 })
}

/* --------------------------------------------------- AI mutations (backend) */

/** Any endpoint that returns `{ quota }` refreshes the cached quota. */
function useQuotaSyncingMutation(mutationFn) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn,
    onSuccess: (res) => {
      if (res?.quota) qc.setQueryData(qk.quota, res.quota)
    },
  })
}

export const useTailor = () => useQuotaSyncingMutation(({ body, onProgress }) => agentApi.tailor(body, onProgress))
export const useScore = () => useQuotaSyncingMutation((body) => agentApi.score(body))
export const useRunAgent = () => useQuotaSyncingMutation(({ id, body }) => agentApi.runAgent(id, body))
