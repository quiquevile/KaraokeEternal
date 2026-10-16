import { describe, it, expect } from 'vitest'
import { parseHistorySize, parseLevel } from './cli.js'

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

describe('cli parseHistorySize', () => {
  it('keeps an explicit 0 (history disabled) instead of falling back', () => {
    expect(parseHistorySize('0')).toBe(0)
  })

  it('parses set sizes', () => {
    expect(parseHistorySize('3')).toBe(3)
    expect(parseHistorySize(' 7 ')).toBe(7)
  })

  it('falls back to the default when missing or invalid', () => {
    expect(parseHistorySize(undefined)).toBe(10)
    expect(parseHistorySize('')).toBe(10)
    expect(parseHistorySize('many')).toBe(10)
    expect(parseHistorySize('-1')).toBe(10)
  })
})
