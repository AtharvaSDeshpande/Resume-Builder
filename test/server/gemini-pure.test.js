import { describe, it, expect } from 'vitest'
import { prettyModel, safeParseJson } from '../../server/llm/gemini.js'

describe('llm/gemini pure helpers', () => {
  describe('prettyModel', () => {
    it('labels Pro / Flash / Flash-Lite with the version', () => {
      expect(prettyModel('gemini-2.5-pro')).toBe('Gemini 2.5 Pro')
      expect(prettyModel('gemini-flash-latest')).toBe('Gemini Flash')
      expect(prettyModel('gemini-flash-lite-latest')).toBe('Gemini Flash-Lite')
    })
    it('falls back to the raw id when unrecognised', () => {
      expect(prettyModel('')).toBe('')
      expect(prettyModel('weird-model')).toBe('weird-model')
    })
  })

  describe('safeParseJson', () => {
    it('parses plain JSON', () => {
      expect(safeParseJson('{"a":1}')).toEqual({ a: 1 })
    })
    it('strips ```json fences', () => {
      expect(safeParseJson('```json\n{"b":2}\n```')).toEqual({ b: 2 })
    })
    it('extracts the object from surrounding prose', () => {
      expect(safeParseJson('Here you go: {"c":3} thanks')).toEqual({ c: 3 })
    })
    it('repairs trailing-comma JSON', () => {
      expect(safeParseJson('{"d":4,}')).toEqual({ d: 4 })
    })
    it('throws LLM_EMPTY on empty input', () => {
      expect(() => safeParseJson('')).toThrowError(expect.objectContaining({ code: 'LLM_EMPTY' }))
      expect(() => safeParseJson('   ')).toThrow()
    })
  })
})
