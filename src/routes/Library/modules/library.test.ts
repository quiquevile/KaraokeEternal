import { describe, it, expect } from 'vitest'
import reducer, {
  markLocateBlinked,
  nextPreferred,
  resetFilterStr,
  setFilterFolder,
  setFilterPreferred,
  setFilterStr,
  setLocateSongId,
  toggleArtistResultExpanded,
  toggleFilterMultiVersion,
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

describe('setFilterFolder', () => {
  it('sets and clears the folder filter', () => {
    const filtered = reducer(undefined, setFilterFolder('1:set1'))

    expect(filtered.filterFolder).toBe('1:set1')

    const cleared = reducer(filtered, setFilterFolder(null))

    expect(cleared.filterFolder).toBe(null)
  })
})

describe('toggleFilterMultiVersion', () => {
  it('toggles the multi-version filter', () => {
    const on = reducer(undefined, toggleFilterMultiVersion())

    expect(on.filterMultiVersion).toBe(true)

    const off = reducer(on, toggleFilterMultiVersion())

    expect(off.filterMultiVersion).toBe(false)
  })
})

describe('setFilterPreferred', () => {
  it('sets and clears the preferred filter', () => {
    const filtered = reducer(undefined, setFilterPreferred('with'))

    expect(filtered.filterPreferred).toBe('with')

    const cleared = reducer(filtered, setFilterPreferred(null))

    expect(cleared.filterPreferred).toBe(null)
  })

  it('cycles off → without → with → off via nextPreferred', () => {
    expect(nextPreferred(null)).toBe('without')
    expect(nextPreferred('without')).toBe('with')
    expect(nextPreferred('with')).toBe(null)

    // driving the reducer through the cycle ends where it started
    let state = reducer(undefined, setFilterPreferred(nextPreferred(null)))
    expect(state.filterPreferred).toBe('without')
    state = reducer(state, setFilterPreferred(nextPreferred(state.filterPreferred)))
    expect(state.filterPreferred).toBe('with')
    state = reducer(state, setFilterPreferred(nextPreferred(state.filterPreferred)))
    expect(state.filterPreferred).toBe(null)
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
    expect(reducer(located, setFilterFolder('1:set1')).locateSongId).toBe(null)
    expect(reducer(located, toggleFilterMultiVersion()).locateSongId).toBe(null)
    expect(reducer(located, setFilterPreferred('without')).locateSongId).toBe(null)
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
