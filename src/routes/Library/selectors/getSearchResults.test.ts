import { describe, it, expect } from 'vitest'
import type { RootState } from 'store/store'
import getSearchTree from './getSearchResults'
import { getSearchResults } from './getSearchResults'

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

interface Fixture {
  artists: { artistId: number, name: string, songIds: number[] }[]
  songs: { songId: number, artistId: number, title: string }[]
  filterStr?: string
  filterStarred?: boolean
  starredSongs?: number[]
}

const buildState = (f: Fixture) => ({
  artists: {
    result: f.artists.map(a => a.artistId),
    entities: Object.fromEntries(f.artists.map(a => [a.artistId, a])),
  },
  songs: {
    result: f.songs.map(s => s.songId),
    entities: Object.fromEntries(f.songs.map(s => [s.songId, { ...s, duration: 0, numMedia: 1 }])),
  },
  library: {
    filterStr: f.filterStr ?? '',
    filterStarred: f.filterStarred ?? false,
  },
  userStars: {
    starredSongs: f.starredSongs ?? [],
    starredArtists: [] as number[],
  },
})

// Re-create the selector per test to bypass cross-test memoization.
const getResults = (state: ReturnType<typeof buildState>) => {
  // The default-exported selector is module-scoped and memoizes across calls.
  // For each call here we pass a fresh state object, but since we vary
  // filterStr/library between tests the memo key changes naturally.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return getSearchResults(state as any).songsResult
}

const beatles = { artistId: 1, name: 'The Beatles', songIds: [10, 11, 12] }
const stones = { artistId: 2, name: 'The Rolling Stones', songIds: [20, 21] }
const queen = { artistId: 3, name: 'Queen', songIds: [30] }

const songs = [
  { songId: 10, artistId: 1, title: 'All Together Now' },
  { songId: 11, artistId: 1, title: 'Yesterday' },
  { songId: 12, artistId: 1, title: 'Hey Jude' },
  { songId: 20, artistId: 2, title: 'Paint It Black' },
  { songId: 21, artistId: 2, title: 'Yesterday\'s Papers' },
  { songId: 30, artistId: 3, title: 'Bohemian Rhapsody' },
]

const libraryFixture: Omit<Fixture, 'filterStr'> = {
  artists: [beatles, stones, queen],
  songs,
}

describe('getSearchResults', () => {
  it('returns the full library when filterStr is empty', () => {
    const result = getResults(buildState({ ...libraryFixture, filterStr: '' }))
    expect(result).toEqual([10, 11, 12, 20, 21, 30])
  })

  it('matches a multi-field query across artist + title', () => {
    const result = getResults(buildState({ ...libraryFixture, filterStr: 'beatles all together' }))
    expect(result[0]).toBe(10) // "All Together Now"
    // other Beatles songs shouldn't match because "all" and "together" aren't in their titles
    expect(result).not.toContain(11)
    expect(result).not.toContain(12)
  })

  it('is order-independent for multi-token queries', () => {
    const a = getResults(buildState({ ...libraryFixture, filterStr: 'beatles all together' }))
    const b = getResults(buildState({ ...libraryFixture, filterStr: 'all together beatles' }))
    const c = getResults(buildState({ ...libraryFixture, filterStr: 'together beatles all' }))
    expect(a).toEqual(b)
    expect(a).toEqual(c)
  })

  it('returns all of an artist\'s songs for a single-word artist query, sorted by title', () => {
    const result = getResults(buildState({ ...libraryFixture, filterStr: 'beatles' }))
    expect(result).toEqual([10, 12, 11]) // All Together Now, Hey Jude, Yesterday — alphabetical
  })

  it('matches a title-only query across any artist', () => {
    const result = getResults(buildState({ ...libraryFixture, filterStr: 'yesterday' }))
    expect(result).toContain(11) // Beatles - Yesterday
    expect(result).toContain(21) // Stones - Yesterday's Papers
  })

  it('tolerates typos within fuzzy threshold', () => {
    const result = getResults(buildState({ ...libraryFixture, filterStr: 'beetles' }))
    expect(result.length).toBeGreaterThan(0)
    // first match should be a Beatles song
    expect([10, 11, 12]).toContain(result[0])
  })

  it('returns empty array when no songs match all tokens', () => {
    const result = getResults(buildState({ ...libraryFixture, filterStr: 'zzzzz xxxxx' }))
    expect(result).toEqual([])
  })

  describe('special characters', () => {
    const fixture: Omit<Fixture, 'filterStr'> = {
      artists: [
        { artistId: 4, name: 'Big & Rich', songIds: [40] },
        { artistId: 5, name: 'Sigur Rós', songIds: [50] },
        { artistId: 6, name: 'Jason Mraz', songIds: [60] },
        { artistId: 7, name: 'AC/DC', songIds: [70] },
      ],
      songs: [
        { songId: 40, artistId: 4, title: 'Save a Horse' },
        { songId: 50, artistId: 5, title: 'Hoppípolla' },
        { songId: 60, artistId: 6, title: 'I\'m Yours' },
        { songId: 70, artistId: 7, title: 'Back in Black' },
      ],
    }

    it('ignores symbol-only tokens', () => {
      expect(getResults(buildState({ ...fixture, filterStr: 'big & rich' }))).toEqual([40])
      expect(getResults(buildState({ ...fixture, filterStr: '&' }))).toEqual([40, 50, 60, 70])
      expect(getResults(buildState({ ...fixture, filterStr: 'big &' }))).toEqual([40])
    })

    it('treats a spaced "&" as "and"', () => {
      expect(getResults(buildState({ ...fixture, filterStr: 'big and rich' }))).toEqual([40])
    })

    it('keeps an unspaced "&" from splitting into single-letter tokens', () => {
      const withRnB: Omit<Fixture, 'filterStr'> = {
        artists: [...fixture.artists, { artistId: 8, name: 'Usher', songIds: [80] }],
        songs: [...fixture.songs, { songId: 80, artistId: 8, title: 'R&B Junkie' }],
      }
      expect(getResults(buildState({ ...withRnB, filterStr: 'r&b' }))).toEqual([80])
      expect(getResults(buildState({ ...withRnB, filterStr: 'rb' }))).toEqual([80])
    })

    it('matches across straight and curly apostrophes', () => {
      expect(getResults(buildState({ ...fixture, filterStr: 'i’m' }))).toEqual([60])
    })

    it('matches unaccented queries against accented names, and vice versa', () => {
      expect(getResults(buildState({ ...fixture, filterStr: 'ros' }))).toEqual([50])
      expect(getResults(buildState({ ...fixture, filterStr: 'hoppipolla' }))).toEqual([50])
      expect(getResults(buildState({ ...fixture, filterStr: 'mráz' }))).toEqual([60])
    })

    it('matches with or without punctuation inside words', () => {
      expect(getResults(buildState({ ...fixture, filterStr: 'acdc' }))).toEqual([70])
      expect(getResults(buildState({ ...fixture, filterStr: 'ac/dc' }))).toEqual([70])
    })
  })

  it('applies the starred filter after ranking', () => {
    const result = getResults(buildState({
      ...libraryFixture,
      filterStr: 'beatles',
      filterStarred: true,
      starredSongs: [12],
    }))
    expect(result).toEqual([12])
  })
})
