import { describe, it, expect } from 'vitest'
import reducer, {
  markLocateBlinked,
  resetFilterStr,
  setFilterStr,
  setLocateSongId,
  toggleArtistResultExpanded,
  toggleFilterDownloaded,
  toggleFilterStarred,
} from './library'

describe('toggleArtistResultExpanded', () => {
  it('expands a collapsed artist', () => {
    const state = reducer(undefined, toggleArtistResultExpanded({ artistId: 7, isExpanded: false }))

    expect(state.expandedArtistResults).toEqual([7])
    expect(state.collapsedArtistResults).toEqual([])
  })

  it('collapses an expanded artist, including auto-expanded ones', () => {
    const state = reducer(undefined, toggleArtistResultExpanded({ artistId: 7, isExpanded: true }))

    expect(state.expandedArtistResults).toEqual([])
    expect(state.collapsedArtistResults).toEqual([7])
  })

  it('re-expands a manually collapsed artist', () => {
    const collapsed = reducer(undefined, toggleArtistResultExpanded({ artistId: 7, isExpanded: true }))
    const state = reducer(collapsed, toggleArtistResultExpanded({ artistId: 7, isExpanded: false }))

    expect(state.expandedArtistResults).toEqual([7])
    expect(state.collapsedArtistResults).toEqual([])
  })

  it('never duplicates ids across transitions', () => {
    const once = reducer(undefined, toggleArtistResultExpanded({ artistId: 7, isExpanded: true }))
    const twice = reducer(once, toggleArtistResultExpanded({ artistId: 7, isExpanded: true }))

    expect(twice.collapsedArtistResults).toEqual([7])
  })
})

describe('setLocateSongId', () => {
  it('sets and clears the located song', () => {
    const located = reducer(undefined, setLocateSongId(42))

    expect(located.locateSongId).toBe(42)

    const cleared = reducer(located, setLocateSongId(null))

    expect(cleared.locateSongId).toBe(null)
  })

  it('drops the highlight when the filter changes', () => {
    const located = reducer(undefined, setLocateSongId(42))

    expect(reducer(located, setFilterStr('queen')).locateSongId).toBe(null)
    expect(reducer(located, resetFilterStr()).locateSongId).toBe(null)
    expect(reducer(located, toggleFilterStarred()).locateSongId).toBe(null)
    expect(reducer(located, toggleFilterDownloaded()).locateSongId).toBe(null)
  })

  it('re-arms the blink on every locate and disarms it after', () => {
    const located = reducer(undefined, setLocateSongId(42))

    expect(located.locateBlinked).toBe(false)

    const blinked = reducer(located, markLocateBlinked())

    expect(blinked.locateBlinked).toBe(true)

    // locating again (even the same song) replays the blink
    expect(reducer(blinked, setLocateSongId(42)).locateBlinked).toBe(false)
  })
})
