import { describe, it, expect } from 'vitest'
import { parseLevel } from './cli.js'

describe('cli parseLevel', () => {
  it('keeps an explicit 0 instead of falling back to the default', () => {
    expect(parseLevel('0')).toBe(0)
  })

  it('parses set levels and ignores missing or invalid ones', () => {
    expect(parseLevel('3')).toBe(3)
    expect(parseLevel(undefined)).toBeUndefined()
    expect(parseLevel('')).toBeUndefined()
    expect(parseLevel('debug')).toBeUndefined()
  })
})
