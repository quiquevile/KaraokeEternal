import { describe, expect, it } from 'vitest'
import type { RootState } from 'store/store'
import getRoundRobinQueue from './getRoundRobinQueue'
import getVisibleQueue from './getVisibleQueue'

const baseState = {
  queue: {
    result: [10, 20, 30],
    entities: {
      10: { queueId: 10, songId: 100, userId: 1, userDisplayName: 'enrique' },
      20: { queueId: 20, songId: 200, userId: 2, userDisplayName: 'maria' },
      30: { queueId: 30, songId: 300, userId: 1, userDisplayName: 'enrique' },
    },
  },
  status: { historyJSON: '[]', queueId: null as number | null, nextUserId: null as number | null },
  songs: {
    entities: {
      100: { songId: 100, artistId: 1, title: 'Big Love', duration: 0, numMedia: 1, isPreferred: false, folders: [] as string[] },
      200: { songId: 200, artistId: 2, title: 'Mamma Mia', duration: 0, numMedia: 1, isPreferred: false, folders: [] as string[] },
      300: { songId: 300, artistId: 1, title: 'The Look', duration: 0, numMedia: 1, isPreferred: false, folders: [] as string[] },
    },
  },
  artists: {
    entities: {
      1: { artistId: 1, name: 'Roxette', songIds: [100, 300] },
      2: { artistId: 2, name: 'ABBA', songIds: [200] },
    },
  },
  userStars: { starredSongs: [200] },
  ui: { filterStr: '', filterStarred: false, filterUserId: null as number | null },
}

const stateWith = (ui: Partial<typeof baseState.ui>): RootState =>
  ({ ...baseState, ui: { ...baseState.ui, ...ui } }) as unknown as RootState

const sorted = (queue: { result: number[] }) => [...queue.result].sort((a, b) => a - b)

describe('getVisibleQueue', () => {
  it('returns the raw queue unchanged when no filter is active', () => {
    const state = stateWith({})

    expect(getVisibleQueue(state)).toBe(getRoundRobinQueue(state))
  })

  it('ignores whitespace-only search text', () => {
    const state = stateWith({ filterStr: '   ' })

    expect(getVisibleQueue(state)).toBe(getRoundRobinQueue(state))
  })

  it('filters by song title, case-insensitively', () => {
    const state = stateWith({ filterStr: 'mAMM' })

    expect(sorted(getVisibleQueue(state))).toEqual([20])
  })

  it('filters by artist name', () => {
    const state = stateWith({ filterStr: 'roxette' })

    expect(sorted(getVisibleQueue(state))).toEqual([10, 30])
  })

  it('filters to starred songs only', () => {
    const state = stateWith({ filterStarred: true })

    expect(sorted(getVisibleQueue(state))).toEqual([20])
  })

  it('filters by user', () => {
    const state = stateWith({ filterUserId: 1 })

    expect(sorted(getVisibleQueue(state))).toEqual([10, 30])
  })

  it('combines filters', () => {
    const state = stateWith({ filterStr: 'love', filterStarred: true, filterUserId: 1 })

    expect(getVisibleQueue(state).result).toEqual([])
  })

  it('returns an empty result when filters match nothing', () => {
    const state = stateWith({ filterUserId: 2, filterStr: 'look' })

    expect(getVisibleQueue(state).result).toEqual([])
  })
})
