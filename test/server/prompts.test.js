import { describe, it, expect } from 'vitest'
import {
  inferIndustryQuery,
  buildCompanyIntelPrompt,
  buildPlacementBuddyPrompt,
  buildIndustryNewsSummaryPrompt,
} from '../../server/prompts/agents.js'

describe('prompts/agents', () => {
  describe('inferIndustryQuery', () => {
    it('prefers company + industry/role', () => {
      expect(inferIndustryQuery({ company: 'Stripe', requirements: { industry: 'fintech' } })).toBe('Stripe fintech')
      expect(inferIndustryQuery({ company: 'Stripe', requirements: { role: 'Backend Engineer' } })).toBe('Stripe Backend Engineer')
    })
    it('falls back to JD words, then a default', () => {
      expect(inferIndustryQuery({ jobDescription: 'Senior data platform engineer needed' })).toContain('Senior data platform')
      expect(inferIndustryQuery({})).toBe('technology industry')
    })
  })

  it('buildCompanyIntelPrompt returns a schema-locked {system,prompt}', () => {
    const { system, prompt } = buildCompanyIntelPrompt({ company: 'Acme', jobDescription: 'JD', profile: {} })
    expect(system).toContain('JSON')
    expect(system).toContain('talkingPoints')
    expect(prompt).toContain('Acme')
  })

  it('buildPlacementBuddyPrompt embeds the résumé digest + schema', () => {
    const { system, prompt } = buildPlacementBuddyPrompt({
      company: 'Acme',
      jobDescription: 'Build things',
      profile: { keySkills: ['React'], profileSummary: { summary: 'Eng' } },
    })
    expect(system).toContain('roadmap')
    expect(prompt).toContain('React')
  })

  it('buildIndustryNewsSummaryPrompt lists the real fetched headlines', () => {
    const items = [{ date: '2026-08-20', title: 'Acme raises money', source: 'TC', url: 'https://x/1' }]
    const { system, prompt } = buildIndustryNewsSummaryPrompt({ input: { company: 'Acme' }, query: 'Acme', items })
    expect(system).toContain('do NOT invent')
    expect(prompt).toContain('Acme raises money')
    expect(prompt).toContain('2026-08-20')
  })
})
