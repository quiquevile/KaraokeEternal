import { describe, it, expect } from 'vitest'
import { fitPathTail } from './fitPathTail'

// 7px per character keeps the arithmetic in the tests readable
const measure = (s: string) => s.length * 7

describe('fitPathTail', () => {
  it('keeps the full path when it fits', () => {
    expect(fitPathTail('/home/user/media', 1000, measure)).toBe('/home/user/media')
  })

  it('keeps the full path on an exact fit', () => {
    expect(fitPathTail('/home', 35, measure)).toBe('/home')
  })

  it('cuts the head with ... and snaps to a segment boundary', () => {
    // 10 chars fit: the raw tail would start inside "user"
    expect(fitPathTail('/home/user/media', 70, measure)).toBe('.../media')
  })

  it('cuts mid-segment when no boundary is left', () => {
    expect(fitPathTail('/abcdefghij', 56, measure)).toBe('...fghij')
  })

  it('degrades to a bare marker when nothing fits', () => {
    expect(fitPathTail('/home', 10, measure)).toBe('...')
  })
})
