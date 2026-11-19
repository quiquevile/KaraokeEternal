import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  filterRecentSearches,
  getHistoryLimit,
  getRecentSearches,
  pushRecentSearch,
} from './recentSearches'

const store: Record<string, string> = {}

const fakeWindow = () => ({
  __KE_CONFIG__: undefined as { historyLibrarySize?: number } | undefined,
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
    expect(getHistoryLimit()).toBe(10)
  })

  it('reads the injected limit', () => {
    win.__KE_CONFIG__ = { historyLibrarySize: 3 }

    expect(getHistoryLimit()).toBe(3)
  })

  it('falls back to 10 on invalid values', () => {
    win.__KE_CONFIG__ = { historyLibrarySize: -1 }

    expect(getHistoryLimit()).toBe(10)
  })
})

describe('pushRecentSearch / getRecentSearches', () => {
  it('stores most-recent-first and dedupes case-insensitively', () => {
    pushRecentSearch('queen')
    pushRecentSearch('abba')
    pushRecentSearch('Queen')

    expect(getRecentSearches()).toEqual(['Queen', 'abba'])
  })

  it('ignores blank terms', () => {
    pushRecentSearch('   ')

    expect(getRecentSearches()).toEqual([])
  })

  it('caps the list at the configured limit', () => {
    win.__KE_CONFIG__ = { historyLibrarySize: 2 }

    pushRecentSearch('one')
    pushRecentSearch('two')
    pushRecentSearch('three')

    expect(getRecentSearches()).toEqual(['three', 'two'])
  })

  it('trims pre-existing longer lists when the limit shrinks', () => {
    pushRecentSearch('one')
    pushRecentSearch('two')
    pushRecentSearch('three')
    win.__KE_CONFIG__ = { historyLibrarySize: 2 }

    expect(getRecentSearches()).toEqual(['three', 'two'])
  })

  it('stores nothing and shows nothing when disabled with 0', () => {
    win.__KE_CONFIG__ = { historyLibrarySize: 0 }

    pushRecentSearch('abba')

    expect(getRecentSearches()).toEqual([])
    expect(store['ke-recent-library']).toBeUndefined()
  })

  it('survives corrupt storage', () => {
    store['ke-recent-library'] = 'not-json{'

    expect(getRecentSearches()).toEqual([])
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
