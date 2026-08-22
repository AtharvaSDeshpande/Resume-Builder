import { QueryClient } from '@tanstack/react-query'

/**
 * Single React Query client for all Express backend-API state (BYOK, quota, and
 * the tailor/score/agent mutations). Firestore's own onSnapshot cache still
 * powers the live collections (positions, résumés) — real-time subscriptions,
 * not polling, so React Query is used where it fits: request/response calls.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 60_000,
    },
    mutations: { retry: 0 },
  },
})

export const qk = {
  byok: ['byok', 'status'],
  quota: ['quota'],
}
