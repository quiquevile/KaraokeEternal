import { describe, expect, it } from 'vitest'
import { ROW_HEIGHT_ARTIST, ROW_HEIGHT_SONG, locateSongOffset } from './locate'

// artist blocks: [collapsed 48] [expanded 48 + 3 songs] [collapsed 48]
const heights = [
  ROW_HEIGHT_ARTIST,
  ROW_HEIGHT_ARTIST + 3 * ROW_HEIGHT_SONG,
  ROW_HEIGHT_ARTIST,
]

describe('locateSongOffset', () => {
  it('places the first song of the first artist below the header', () => {
    // song top = 100 (spacer) + 48 (artist header) = 148;
    // 148 - 25% of 400 = 48
    expect(locateSongOffset(100, heights, 0, 0, 400)).toBe(48)
  })

  it('accounts for preceding artists', () => {
    // artist 1 top = 100 + 48 = 148; its second song top = 148 + 48 + 56;
    // 252 - 25% of 400 = 152
    expect(locateSongOffset(100, heights, 1, 1, 400)).toBe(152)
  })

  it('clamps songs above the fold to zero', () => {
    expect(locateSongOffset(0, [ROW_HEIGHT_ARTIST], 0, 0, 800)).toBe(0)
  })

  it('honours a custom viewport ratio', () => {
    // song top = 148; 148 - 50% of 200 = 48
    expect(locateSongOffset(100, heights, 0, 0, 200, 0.5)).toBe(48)
  })
})
