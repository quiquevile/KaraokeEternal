import { describe, expect, it } from 'vitest'
import {
  applyCaseStep,
  capitalizeFirst,
  CASE_STEP_COUNT,
  toLowerCase,
  toSentenceCase,
  toTitleCase,
  toUpperCase,
} from './caseCycle'

describe('caseCycle', () => {
  it('cycles through all six steps and back to the original', () => {
    const base = 'Paint and Sing with Ana'

    expect(applyCaseStep(base, 0)).toBe('Paint and Sing with Ana')
    expect(applyCaseStep(base, 1)).toBe('Paint and sing with ana')
    expect(applyCaseStep(base, 2)).toBe('Paint And Sing With Ana')
    expect(applyCaseStep(base, 3)).toBe('paint and sing with ana')
    expect(applyCaseStep(base, 4)).toBe('PAINT AND SING WITH ANA')
    expect(applyCaseStep(base, 5)).toBe('Paint and Sing with Ana')
    expect(applyCaseStep(base, CASE_STEP_COUNT)).toBe(base)
  })

  it('preserves internal capitals when capitalizing the first character', () => {
    expect(capitalizeFirst('abba - dancing queen')).toBe('Abba - dancing queen')
    expect(capitalizeFirst('AC/DC - back in black')).toBe('AC/DC - back in black')
  })

  it('handles empty strings', () => {
    expect(toSentenceCase('')).toBe('')
    expect(toTitleCase('')).toBe('')
    expect(toLowerCase('')).toBe('')
    expect(toUpperCase('')).toBe('')
    expect(capitalizeFirst('')).toBe('')
  })
})
