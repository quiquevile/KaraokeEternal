import { describe, it, expect } from 'vitest'
import type { RootState } from 'store/store'
import getSearchTree from './getSearchResults'

// Aitana: 10 Superestrella (star), 11 Vas a quedarte
// Fito: 20 La casa por el tejado (star)
// Martika: 30 Tarzan y Jane
// Mecano: 40 Me cole en una fiesta (star), 41 Barco super, 42 Voy a quedarme
// Roxette: 50 Big love (star), 51 Super Crash, 52 Acme (star)
// multi-version (numMedia >= 2): 10, 30, 40, 42, 51
// preferred: 10, 20, 40, 50
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
      10: { songId: 10, artistId: 1, title: 'Superestrella', folders: ['1:cds'], numMedia: 2, isPreferred: true },
      11: { songId: 11, artistId: 1, title: 'Vas a quedarte', folders: ['1:cds'], numMedia: 1, isPreferred: false },
      20: { songId: 20, artistId: 2, title: 'La casa por el tejado', folders: ['1:new'], numMedia: 1, isPreferred: true },
      30: { songId: 30, artistId: 3, title: 'Tarzan y Jane', folders: ['1:new'], numMedia: 3, isPreferred: false },
      40: { songId: 40, artistId: 4, title: 'Me cole en una fiesta', folders: ['1:cds', '1:new'], numMedia: 2, isPreferred: true },
      41: { songId: 41, artistId: 4, title: 'Barco super', folders: ['1:new'], numMedia: 1, isPreferred: false },
      42: { songId: 42, artistId: 4, title: 'Voy a quedarme', folders: ['1:cds'], numMedia: 2, isPreferred: false },
      50: { songId: 50, artistId: 5, title: 'Big love', folders: ['1:cds'], numMedia: 1, isPreferred: true },
      51: { songId: 51, artistId: 5, title: 'Super Crash', folders: ['1:new'], numMedia: 2, isPreferred: false },
      52: { songId: 52, artistId: 5, title: 'Acme', folders: ['1:new'], numMedia: 1, isPreferred: false },
    },
  },
  library: { filterStr: '', filterStarred: false, filterFlawed: false, filterFolder: null, filterMultiVersion: false, filterPreferred: null },
  userStars: { starredArtists: [], starredSongs: [10, 20, 40, 50, 52] },
  userFlaws: { userId: null, flawedSongs: [30, 42, 52] },
} as unknown as RootState

const search = (
  filterStr: string,
  filterStarred = false,
  filterFlawed = false,
  filterFolder: string | null = null,
  filterMultiVersion = false,
  filterPreferred: 'without' | 'with' | null = null,
): RootState => ({
  ...state,
  library: { filterStr, filterStarred, filterFlawed, filterFolder, filterMultiVersion, filterPreferred },
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

  it('5. text "me" and starred', () => {
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

  it('7. flawed: only defective songs, artists expanded', () => {
    expect(getSearchTree(search('', false, true))).toEqual([
      { artistId: 3, songIds: [30], autoExpanded: true },
      { artistId: 4, songIds: [42], autoExpanded: true },
      { artistId: 5, songIds: [52], autoExpanded: true },
    ])
  })

  it('8. starred and flawed', () => {
    expect(getSearchTree(search('', true, true))).toEqual([
      { artistId: 5, songIds: [52], autoExpanded: true },
    ])
  })

  it('9. folder: only songs in that folder, artists expanded', () => {
    expect(getSearchTree(search('', false, false, '1:cds'))).toEqual([
      { artistId: 1, songIds: [10, 11], autoExpanded: true },
      { artistId: 4, songIds: [40, 42], autoExpanded: true },
      { artistId: 5, songIds: [50], autoExpanded: true },
    ])
  })

  it('10. folder and starred', () => {
    expect(getSearchTree(search('', true, false, '1:cds'))).toEqual([
      { artistId: 1, songIds: [10], autoExpanded: true },
      { artistId: 4, songIds: [40], autoExpanded: true },
      { artistId: 5, songIds: [50], autoExpanded: true },
    ])
  })

  it('11. text "super" and folder', () => {
    expect(getSearchTree(search('super', false, false, '1:new'))).toEqual([
      { artistId: 4, songIds: [41], autoExpanded: true },
      { artistId: 5, songIds: [51], autoExpanded: true },
    ])
  })

  it('12. multi-version: only songs with at least two media, artists expanded', () => {
    expect(getSearchTree(search('', false, false, null, true))).toEqual([
      { artistId: 1, songIds: [10], autoExpanded: true },
      { artistId: 3, songIds: [30], autoExpanded: true },
      { artistId: 4, songIds: [40, 42], autoExpanded: true },
      { artistId: 5, songIds: [51], autoExpanded: true },
    ])
  })

  it('13. preferred "with": only songs with a preferred version', () => {
    expect(getSearchTree(search('', false, false, null, false, 'with'))).toEqual([
      { artistId: 1, songIds: [10], autoExpanded: true },
      { artistId: 2, songIds: [20], autoExpanded: true },
      { artistId: 4, songIds: [40], autoExpanded: true },
      { artistId: 5, songIds: [50], autoExpanded: true },
    ])
  })

  it('14. preferred "without": only songs with no preferred version', () => {
    expect(getSearchTree(search('', false, false, null, false, 'without'))).toEqual([
      { artistId: 1, songIds: [11], autoExpanded: true },
      { artistId: 3, songIds: [30], autoExpanded: true },
      { artistId: 4, songIds: [41, 42], autoExpanded: true },
      { artistId: 5, songIds: [51, 52], autoExpanded: true },
    ])
  })

  it('15. multi-version and starred', () => {
    expect(getSearchTree(search('', true, false, null, true))).toEqual([
      { artistId: 1, songIds: [10], autoExpanded: true },
      { artistId: 4, songIds: [40], autoExpanded: true },
    ])
  })

  it('16. text "super" and preferred "without"', () => {
    expect(getSearchTree(search('super', false, false, null, false, 'without'))).toEqual([
      { artistId: 4, songIds: [41], autoExpanded: true },
      { artistId: 5, songIds: [51], autoExpanded: true },
    ])
  })

  it('17. text "&": no letters, matches nothing in the main fixture', () => {
    expect(getSearchTree(search('&'))).toEqual([])
  })
})

// symbol fixture: fast-fuzzy drops symbols from queries and keys, so
// symbol-only queries ("&") need the literal fallback; mixed queries
// keep going through the fuzzy searchers
// Simon & Garfunkel: 10 Bridge Over Troubled Water
// AC/DC: 20 You Shook Me All Night Long
const symbolState = {
  artists: {
    result: [1, 2],
    entities: {
      1: { artistId: 1, name: 'Simon & Garfunkel', songIds: [10] },
      2: { artistId: 2, name: 'AC/DC', songIds: [20] },
    },
  },
  songs: {
    result: [10, 20],
    entities: {
      10: { songId: 10, artistId: 1, title: 'Bridge Over Troubled Water', folders: ['1:new'], numMedia: 1, isPreferred: false },
      20: { songId: 20, artistId: 2, title: 'You Shook Me All Night Long', folders: ['1:new'], numMedia: 1, isPreferred: false },
    },
  },
  library: { filterStr: '', filterStarred: false, filterFlawed: false, filterFolder: null, filterMultiVersion: false, filterPreferred: null },
  userStars: { starredArtists: [], starredSongs: [] },
  userFlaws: { userId: null, flawedSongs: [] },
} as unknown as RootState

const searchSymbols = (filterStr: string): RootState => ({
  ...symbolState,
  library: { ...symbolState.library, filterStr },
} as unknown as RootState)

describe('getSearchTree symbol-only queries', () => {
  it('18. text "&": literal fallback matches the artist name', () => {
    expect(getSearchTree(searchSymbols('&'))).toEqual([
      { artistId: 1, songIds: [10], autoExpanded: false },
    ])
  })

  it('19. text "/": literal fallback matches AC/DC', () => {
    expect(getSearchTree(searchSymbols('/'))).toEqual([
      { artistId: 2, songIds: [20], autoExpanded: false },
    ])
  })

  it('20. text "!!!": no literal match, empty tree', () => {
    expect(getSearchTree(searchSymbols('!!!'))).toEqual([])
  })

  it('21. text "shook": fuzzy path still works', () => {
    expect(getSearchTree(searchSymbols('shook'))).toEqual([
      { artistId: 2, songIds: [20], autoExpanded: true },
    ])
  })

  it('22. text "simon &": mixed query still matches via fuzzy path', () => {
    expect(getSearchTree(searchSymbols('simon &'))).toEqual([
      { artistId: 1, songIds: [10], autoExpanded: false },
    ])
  })
})
