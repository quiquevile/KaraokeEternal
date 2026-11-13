import { describe, expect, it } from 'vitest'
import getDisplayQueue, { type DisplayRow } from './getDisplayQueue'
import getVisibleDisplayQueue from './getVisibleDisplayQueue'
import { providerFetchKey, type ProviderFetchView } from '../../Library/modules/library'
import type { RootState } from '../../../store/store'

interface Fixture {
  // [queueId, userId] in queue order; each item's songId is its queueId
  queue?: [number, number][]
  history?: number[]
  queueId?: number
  nextUserId?: number | null
  fetches?: ProviderFetchView[]
  ui?: Partial<{ filterStr: string, filterStarred: boolean, filterUserId: number | null }>
}

// songId doubles as artistId: title/artist per songId
const TITLES: Record<number, string> = { 1: 'Big Love', 2: 'Mamma Mia', 3: 'The Look' }
const ARTISTS: Record<number, string> = { 1: 'Roxette', 2: 'ABBA', 3: 'Roxette' }

const stateWith = ({
  queue = [],
  history = [],
  queueId = -1,
  nextUserId = null,
  fetches = [],
  ui = {},
}: Fixture): RootState => ({
  queue: {
    result: queue.map(([qId]) => qId),
    entities: Object.fromEntries(queue.map(([qId, userId]) => [qId, { queueId: qId, songId: qId, userId }])),
  },
  status: { queueId, nextUserId, historyJSON: JSON.stringify(history) },
  library: {
    providerFetches: Object.fromEntries(fetches.map(f => [providerFetchKey(f.providerId, f.itemId), f])),
  },
  songs: {
    entities: Object.fromEntries(queue.map(([qId]) => [qId, {
      songId: qId,
      artistId: qId,
      title: TITLES[qId] ?? `Song ${qId}`,
      duration: 200,
    }])),
  },
  artists: {
    entities: Object.fromEntries(queue.map(([qId]) => [qId, {
      artistId: qId,
      name: ARTISTS[qId] ?? 'Unknown',
    }])),
  },
  // song 2 is starred
  userStars: { starredSongs: [2] },
  ui: {
    filterStr: '',
    filterStarred: false,
    filterUserId: null,
    ...ui,
  },
} as unknown as RootState)

// one fetch per singer listed: [userId, timestamp]
const fetch = (itemId: string, requests: [number, number][], overrides: Partial<ProviderFetchView> = {}): ProviderFetchView => ({
  providerId: 1,
  itemId,
  status: 'downloading',
  progress: 0.5,
  title: 'Title',
  artist: 'Artist',
  requests: requests.map(([userId, timestamp]) => ({ userId, timestamp, userDisplayName: 'User', userDateUpdated: 0 })),
  ...overrides,
})

const label = (row: DisplayRow) => row.kind === 'queue' ? row.queueId : `${row.item.itemId}:${row.userId}`
const labels = (state: RootState) => getVisibleDisplayQueue(state).map(label)

describe('getVisibleDisplayQueue', () => {
  it('returns the display rows unchanged when no filter is active', () => {
    const state = stateWith({
      queue: [[1, 1], [2, 2], [3, 1]],
      queueId: 1,
      fetches: [fetch('p', [[2, 100]])],
    })

    expect(getVisibleDisplayQueue(state)).toBe(getDisplayQueue(state))
  })

  it('ignores whitespace-only search text', () => {
    const state = stateWith({
      queue: [[1, 1], [2, 2]],
      queueId: 1,
      ui: { filterStr: '   ' },
    })

    expect(getVisibleDisplayQueue(state)).toBe(getDisplayQueue(state))
  })

  it('filters queued rows by title, case-insensitively', () => {
    const state = stateWith({
      queue: [[1, 1], [2, 2], [3, 1]],
      queueId: 1,
      ui: { filterStr: 'mAMM' },
    })

    expect(labels(state)).toEqual([2])
  })

  it('filters queued rows by artist name', () => {
    const state = stateWith({
      queue: [[1, 1], [2, 2], [3, 1]],
      queueId: 1,
      ui: { filterStr: 'roxette' },
    })

    expect(labels(state)).toEqual([1, 3])
  })

  it('filters in-flight rows by their own title and artist', () => {
    const state = stateWith({
      fetches: [
        fetch('p', [[2, 100]], { title: 'Bohemian', artist: 'Queen' }),
        fetch('q', [[3, 100]], { title: 'Other', artist: 'Nobody' }),
      ],
      ui: { filterStr: 'bohemian' },
    })

    expect(labels(state)).toEqual(['p:2'])
  })

  it('keeps only starred rows, excluding in-flight ones', () => {
    // pending songs aren't in the library yet, so they can never be starred
    const state = stateWith({
      queue: [[1, 1], [2, 2]],
      queueId: 1,
      fetches: [fetch('p', [[2, 100]])],
      ui: { filterStarred: true },
    })

    expect(labels(state)).toEqual([2])
  })

  it('filters queued and in-flight rows by user', () => {
    const state = stateWith({
      queue: [[1, 1], [2, 2], [3, 1]],
      queueId: 1,
      fetches: [fetch('p', [[2, 100]])],
      ui: { filterUserId: 2 },
    })

    expect(labels(state)).toEqual([2, 'p:2'])
  })

  it('returns no rows when the filters match nothing', () => {
    const state = stateWith({
      queue: [[1, 1], [2, 2]],
      queueId: 1,
      fetches: [fetch('p', [[2, 100]])],
      ui: { filterStr: 'zzz' },
    })

    expect(labels(state)).toEqual([])
  })
})
