import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock the LLM layer so the registry is tested without any network calls.
// vi.hoisted lets the mock factory (which is hoisted) reference these safely.
const m = vi.hoisted(() => ({
  generateJSON: vi.fn(),
  resolveBestModel: vi.fn(async () => 'gemini-2.5-pro'),
  runToolAgent: vi.fn(async () => ({ data: { verdict: 'ok' }, steps: [], sources: [], modelUsed: 'gemini-2.5-pro' })),
}))
vi.mock('../../server/llm/gemini.js', () => m)

import { runAgent, isAgent, AGENTS } from '../../server/agents/index.js'

describe('agents/index (registry + dispatch)', () => {
  beforeEach(() => {
    m.generateJSON.mockReset()
    m.generateJSON.mockResolvedValue({
      data: { company: 'Acme', oneLiner: 'Payments' },
      sources: [{ title: 'src', url: 'https://x' }],
      modelUsed: 'gemini-2.5-pro',
      grounded: true,
    })
    m.resolveBestModel.mockClear()
  })

  it('knows its agents', () => {
    expect(Object.keys(AGENTS)).toEqual(expect.arrayContaining(['companyIntel', 'placementBuddy', 'industryNews']))
    expect(isAgent('companyIntel')).toBe(true)
    expect(isAgent('nope')).toBe(false)
  })

  it('runs a prompt agent on the best model with web search', async () => {
    const res = await runAgent('companyIntel', { company: 'Acme', jobDescription: 'JD', profile: {} })
    expect(m.resolveBestModel).toHaveBeenCalled()
    expect(m.generateJSON).toHaveBeenCalledWith(expect.objectContaining({ model: 'gemini-2.5-pro', useSearch: true }))
    expect(res).toMatchObject({ agentId: 'companyIntel', grounded: true, model: 'gemini-2.5-pro' })
    expect(res.data.company).toBe('Acme')
    expect(res.generatedAtMs).toEqual(expect.any(Number))
  })

  it('rejects an unknown agent', async () => {
    await expect(runAgent('bogus', {})).rejects.toMatchObject({ code: 'UNKNOWN_AGENT', status: 404 })
  })
})
