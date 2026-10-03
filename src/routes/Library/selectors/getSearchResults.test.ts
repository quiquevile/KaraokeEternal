import { describe, it, expect } from 'vitest'
import type { RootState } from 'store/store'
import getSearchTree from './getSearchResults'

// Aitana: 10 Superestrella (star+dl), 11 Vas a quedarte (dl)
// Fito: 20 La casa por el tejado (star)
// Martika: 30 Tarzan y Jane
// Mecano: 40 Me cole en una fiesta (star), 41 Barco super (dl), 42 Voy a quedarme
// Roxette: 50 Big love (star+dl), 51 Super Crash (dl), 52 Acme (star)
const state = {
  artists: {
    result: [1, 2, 3, 4, 5],
    entities: {
      1: { artistId: 1, name: 'Aitana', songIds: [10, 11] },
      2: { artistId: 2, name: 'Fito', songIds: [20] },
      3: { artistId: 3, name: 'Martika', songIds: [30] },
      4: { artistId: 4, name: 'Mecano', songIds: [40, 41, 42] },
      5: { artistId: 5, name: 'Roxette', songIds: [50, 51, 52] },
    },
  },
  songs: {
    result: [10, 11, 20, 30, 40, 41, 42, 50, 51, 52],
    entities: {
      10: { songId: 10, artistId: 1, title: 'Superestrella', isDownloaded: true },
      11: { songId: 11, artistId: 1, title: 'Vas a quedarte', isDownloaded: true },
      20: { songId: 20, artistId: 2, title: 'La casa por el tejado', isDownloaded: false },
      30: { songId: 30, artistId: 3, title: 'Tarzan y Jane', isDownloaded: false },
      40: { songId: 40, artistId: 4, title: 'Me cole en una fiesta', isDownloaded: false },
      41: { songId: 41, artistId: 4, title: 'Barco super', isDownloaded: true },
      42: { songId: 42, artistId: 4, title: 'Voy a quedarme', isDownloaded: false },
      50: { songId: 50, artistId: 5, title: 'Big love', isDownloaded: true },
      51: { songId: 51, artistId: 5, title: 'Super Crash', isDownloaded: true },
      52: { songId: 52, artistId: 5, title: 'Acme', isDownloaded: false },
    },
  },
  library: { filterStr: '', filterStarred: false, filterDownloaded: false },
  userStars: { starredArtists: [], starredSongs: [10, 20, 40, 50, 52] },
} as unknown as RootState

const search = (filterStr: string, filterStarred = false, filterDownloaded = false): RootState => ({
  ...state,
  library: { filterStr, filterStarred, filterDownloaded },
} as unknown as RootState)

describe('getSearchTree', () => {
  it('1. lists the whole tree without search', () => {
    expect(getSearchTree(state)).toEqual([
      { artistId: 1, songIds: [10, 11], autoExpanded: true },
      { artistId: 2, songIds: [20], autoExpanded: true },
      { artistId: 3, songIds: [30], autoExpanded: true },
      { artistId: 4, songIds: [40, 41, 42], autoExpanded: true },
      { artistId: 5, songIds: [50, 51, 52], autoExpanded: true },
    ])
  })

  it('2. text "me": artist match lists everything, song match lists itself', () => {
    expect(getSearchTree(search('me'))).toEqual([
      { artistId: 4, songIds: [40, 41, 42], autoExpanded: true },
      { artistId: 5, songIds: [52], autoExpanded: true },
    ])
  })

  it('3. text "na": artist-only matches stay collapsed', () => {
    expect(getSearchTree(search('na'))).toEqual([
      { artistId: 1, songIds: [10, 11], autoExpanded: false },
      { artistId: 4, songIds: [40], autoExpanded: true },
    ])
  })

  it('4. starred: only starred songs, artists expanded', () => {
    expect(getSearchTree(search('', true))).toEqual([
      { artistId: 1, songIds: [10], autoExpanded: true },
      { artistId: 2, songIds: [20], autoExpanded: true },
      { artistId: 4, songIds: [40], autoExpanded: true },
      { artistId: 5, songIds: [50, 52], autoExpanded: true },
    ])
  })

  it('5a. downloaded: only downloaded songs, artists expanded', () => {
    expect(getSearchTree(search('', false, true))).toEqual([
      { artistId: 1, songIds: [10, 11], autoExpanded: true },
      { artistId: 4, songIds: [41], autoExpanded: true },
      { artistId: 5, songIds: [50, 51], autoExpanded: true },
    ])
  })

  it('5b. starred and downloaded', () => {
    expect(getSearchTree(search('', true, true))).toEqual([
      { artistId: 1, songIds: [10], autoExpanded: true },
      { artistId: 5, songIds: [50], autoExpanded: true },
    ])
  })

  it('5c. text "me" and starred', () => {
    expect(getSearchTree(search('me', true))).toEqual([
      { artistId: 4, songIds: [40], autoExpanded: true },
      { artistId: 5, songIds: [52], autoExpanded: true },
    ])
  })

  it('6. text "ro" and starred', () => {
    expect(getSearchTree(search('ro', true))).toEqual([
      { artistId: 5, songIds: [50, 52], autoExpanded: false },
    ])
  })

  it('7. text "super" and downloaded', () => {
    expect(getSearchTree(search('super', false, true))).toEqual([
      { artistId: 1, songIds: [10], autoExpanded: true },
      { artistId: 4, songIds: [41], autoExpanded: true },
      { artistId: 5, songIds: [51], autoExpanded: true },
    ])
  })

  it('8. text "tana" and downloaded', () => {
    expect(getSearchTree(search('tana', false, true))).toEqual([
      { artistId: 1, songIds: [10, 11], autoExpanded: false },
    ])
  })

  it('9. text "te" with starred and downloaded', () => {
    expect(getSearchTree(search('te', true, true))).toEqual([
      { artistId: 5, songIds: [50], autoExpanded: false },
    ])
  })
})
