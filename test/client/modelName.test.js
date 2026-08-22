import { describe, it, expect } from 'vitest'
import { prettyModel } from '../../src/utils/modelName.js'

describe('utils/modelName prettyModel', () => {
  it('formats known Gemini ids', () => {
    expect(prettyModel('gemini-2.5-pro')).toBe('Gemini 2.5 Pro')
    expect(prettyModel('gemini-flash-latest')).toBe('Gemini Flash')
    expect(prettyModel('gemini-flash-lite-latest')).toBe('Gemini Flash-Lite')
  })
  it('is safe on empty / unknown input', () => {
    expect(prettyModel('')).toBe('')
    expect(prettyModel(undefined)).toBe('')
    expect(prettyModel('custom-thing')).toBe('custom-thing')
  })
})
