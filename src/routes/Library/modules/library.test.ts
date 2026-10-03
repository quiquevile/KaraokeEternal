import { describe, it, expect } from 'vitest'
import reducer, { toggleArtistResultExpanded } from './library'

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
