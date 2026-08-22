import { describe, it, expect } from 'vitest'
import { safeUrl } from '../../src/utils/url.js'

describe('utils/url safeUrl', () => {
  it('allows http and https', () => {
    expect(safeUrl('https://example.com/a')).toBe('https://example.com/a')
    expect(safeUrl('http://example.com')).toBe('http://example.com/')
  })

  it('blocks dangerous schemes (XSS vectors)', () => {
    expect(safeUrl('javascript:alert(1)')).toBeNull()
    expect(safeUrl('data:text/html,<script>1</script>')).toBeNull()
    expect(safeUrl('vbscript:msgbox(1)')).toBeNull()
  })

  it('resolves relative urls against the origin as http(s)', () => {
    const out = safeUrl('/positions/1')
    expect(out).toMatch(/^https?:\/\//)
    expect(out).toMatch(/\/positions\/1$/)
  })

  it('returns null for empty / non-string input', () => {
    expect(safeUrl('')).toBeNull()
    expect(safeUrl(null)).toBeNull()
    expect(safeUrl(undefined)).toBeNull()
    expect(safeUrl(42)).toBeNull()
  })
})
