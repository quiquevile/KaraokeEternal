import { describe, it, expect } from 'vitest'
import type { RootState } from 'store/store'
import getSearchResults from './getSearchResults'

const state = {
  artists: {
    result: [1, 2],
    entities: {
      1: { artistId: 1, name: 'ABBA', songIds: [10] },
      2: { artistId: 2, name: 'Queen', songIds: [20] },
    },
  },
  songs: {
    result: [10, 20],
    entities: {
      10: { songId: 10, artistId: 1, title: 'Dancing Queen' },
      20: { songId: 20, artistId: 2, title: 'Bohemian Rhapsody' },
    },
  },
  library: { filterStr: '', filterStarred: false },
  userStars: { starredArtists: [2], starredSongs: [20] },
} as unknown as RootState

const withFilter = (filterStr: string, filterStarred = false): RootState => ({
  ...state,
  library: { filterStr, filterStarred },
} as unknown as RootState)

describe('getSearchResults', () => {
  it('returns everything without filters', () => {
    expect(getSearchResults(state)).toEqual({
      artistsResult: [1, 2],
      songsResult: [10, 20],
    })
  })

  it('matches artists and songs fuzzily', () => {
    const res = getSearchResults(withFilter('queen'))

    expect(res.artistsResult).toEqual([2])
    expect(res.songsResult).toEqual([10])
  })

  it('returns nothing for unmatched queries', () => {
    const res = getSearchResults(withFilter('xyzzy-nomatch'))

    expect(res).toEqual({ artistsResult: [], songsResult: [] })
  })

  it('filters to starred items', () => {
    const res = getSearchResults(withFilter('', true))

    expect(res).toEqual({ artistsResult: [2], songsResult: [20] })
  })

  it('combines keyword and starred filters', () => {
    const res = getSearchResults(withFilter('bohemian', true))

    expect(res.artistsResult).toEqual([])
    expect(res.songsResult).toEqual([20])
  })
})
