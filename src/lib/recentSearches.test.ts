import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  filterRecentSearches,
  getHistoryLimit,
  getRecentSearches,
  pushRecentSearch,
} from './recentSearches'

const store: Record<string, string> = {}

const fakeWindow = () => ({
  __KE_CONFIG__: undefined as { historyLibrarySize?: number, historyYoutubeSize?: number } | undefined,
  localStorage: {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => {
      store[key] = value
    },
  },
})

let win: ReturnType<typeof fakeWindow>

beforeEach(() => {
  for (const key of Object.keys(store)) delete store[key]

  win = fakeWindow()
  vi.stubGlobal('window', win)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('getHistoryLimit', () => {
  it('defaults to 10 without injected config', () => {
    expect(getHistoryLimit('library')).toBe(10)
    expect(getHistoryLimit('youtube')).toBe(10)
  })

  it('reads per-scope injected limits, keeping an explicit 0', () => {
    win.__KE_CONFIG__ = { historyLibrarySize: 3, historyYoutubeSize: 0 }

    expect(getHistoryLimit('library')).toBe(3)
    expect(getHistoryLimit('youtube')).toBe(0)
  })

  it('falls back to 10 on invalid values', () => {
    win.__KE_CONFIG__ = { historyLibrarySize: -1, historyYoutubeSize: 2.5 }

    expect(getHistoryLimit('library')).toBe(10)
    expect(getHistoryLimit('youtube')).toBe(10)
  })
})

describe('pushRecentSearch / getRecentSearches', () => {
  it('stores most-recent-first and dedupes case-insensitively', () => {
    pushRecentSearch('library', 'queen')
    pushRecentSearch('library', 'abba')
    pushRecentSearch('library', 'Queen')

    expect(getRecentSearches('library')).toEqual(['Queen', 'abba'])
  })

  it('ignores blank terms', () => {
    pushRecentSearch('library', '   ')

    expect(getRecentSearches('library')).toEqual([])
  })

  it('caps the list at the configured limit', () => {
    win.__KE_CONFIG__ = { historyLibrarySize: 2 }

    pushRecentSearch('library', 'one')
    pushRecentSearch('library', 'two')
    pushRecentSearch('library', 'three')

    expect(getRecentSearches('library')).toEqual(['three', 'two'])
  })

  it('trims pre-existing longer lists when the limit shrinks', () => {
    pushRecentSearch('library', 'one')
    pushRecentSearch('library', 'two')
    pushRecentSearch('library', 'three')
    win.__KE_CONFIG__ = { historyLibrarySize: 2 }

    expect(getRecentSearches('library')).toEqual(['three', 'two'])
  })

  it('keeps scopes separate', () => {
    pushRecentSearch('library', 'queen')
    pushRecentSearch('youtube', 'abba')

    expect(getRecentSearches('library')).toEqual(['queen'])
    expect(getRecentSearches('youtube')).toEqual(['abba'])
  })

  it('stores nothing and shows nothing when disabled with 0', () => {
    win.__KE_CONFIG__ = { historyYoutubeSize: 0 }

    pushRecentSearch('youtube', 'abba')

    expect(getRecentSearches('youtube')).toEqual([])
    expect(store['ke-recent-youtube']).toBeUndefined()
  })

  it('survives corrupt storage', () => {
    store['ke-recent-library'] = 'not-json{'

    expect(getRecentSearches('library')).toEqual([])
  })
})

describe('filterRecentSearches', () => {
  const items = ['Queen', 'AbbA', 'The Beatles']

  it('matches substrings case-insensitively', () => {
    expect(filterRecentSearches(items, 'bb')).toEqual(['AbbA'])
    expect(filterRecentSearches(items, 'QUE')).toEqual(['Queen'])
  })

  it('returns everything on empty input', () => {
    expect(filterRecentSearches(items, '  ')).toEqual(items)
  })
})
