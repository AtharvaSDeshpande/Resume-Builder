import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

// Mock the HTTP client so the hooks are tested without touching the network.
vi.mock('../../src/services/agentApi.js', () => ({
  agentApi: {
    byokStatus: vi.fn(),
    byokSave: vi.fn(),
    byokRemove: vi.fn(),
    quota: vi.fn(),
    runAgent: vi.fn(),
    tailor: vi.fn(),
    score: vi.fn(),
  },
}))
import { agentApi } from '../../src/services/agentApi.js'
import { useByokStatus, useSaveByok, useRunAgent } from '../../src/queries/backend.js'

function makeClientWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const wrapper = ({ children }) => <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  return { qc, wrapper }
}

beforeEach(() => vi.clearAllMocks())

describe('queries/backend (React Query hooks)', () => {
  it('useByokStatus fetches and exposes status', async () => {
    agentApi.byokStatus.mockResolvedValue({ available: true, hasKey: true, hint: 'AIza…1234' })
    const { wrapper } = makeClientWrapper()
    const { result } = renderHook(() => useByokStatus(true), { wrapper })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toMatchObject({ hasKey: true, hint: 'AIza…1234' })
    expect(agentApi.byokStatus).toHaveBeenCalledOnce()
  })

  it('useByokStatus does not fetch when disabled', () => {
    const { wrapper } = makeClientWrapper()
    renderHook(() => useByokStatus(false), { wrapper })
    expect(agentApi.byokStatus).not.toHaveBeenCalled()
  })

  it('useSaveByok writes the returned status into the byok cache', async () => {
    agentApi.byokSave.mockResolvedValue({ available: true, hasKey: true, hint: 'AIza…9999' })
    const { qc, wrapper } = makeClientWrapper()
    const { result } = renderHook(() => useSaveByok(), { wrapper })

    await act(async () => {
      await result.current.mutateAsync('AIza-newkey')
    })
    expect(agentApi.byokSave).toHaveBeenCalledWith('AIza-newkey')
    expect(qc.getQueryData(['byok', 'status'])).toMatchObject({ hasKey: true, hint: 'AIza…9999' })
  })

  it('useRunAgent calls the endpoint and syncs quota from the response', async () => {
    agentApi.runAgent.mockResolvedValue({
      agentId: 'companyIntel',
      data: { company: 'Acme' },
      quota: { enforced: true, features: { companyIntel: { used: 1, limit: 1, remaining: 0 } } },
    })
    const { qc, wrapper } = makeClientWrapper()
    const { result } = renderHook(() => useRunAgent(), { wrapper })

    let out
    await act(async () => {
      out = await result.current.mutateAsync({ id: 'companyIntel', body: { company: 'Acme' } })
    })
    expect(agentApi.runAgent).toHaveBeenCalledWith('companyIntel', { company: 'Acme' })
    expect(out.data.company).toBe('Acme')
    expect(qc.getQueryData(['quota'])).toMatchObject({ enforced: true })
  })
})
