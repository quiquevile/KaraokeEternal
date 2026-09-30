import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { configureStore } from '@reduxjs/toolkit'
import reducer, { clearYoutubeResults, fetchDownloadUsers, searchYoutubeVideos, type YouTubeResult } from './youtube'

const fullResult = (id: string): YouTubeResult => ({
  artist: 'ABBA',
  duration: 200,
  durationLabel: '3:20',
  id,
  thumbnail: 'http://localhost/t.jpg',
  title: 'Dancing Queen',
  url: `http://localhost/watch?v=${id}`,
})

const users = [
  { userId: 1, username: 'admin', name: 'Admin' },
  { userId: 2, username: 'pepe', name: 'Pepe' },
]

const makeStore = () => configureStore({ reducer: { youtube: reducer } })

beforeEach(() => {
  vi.stubGlobal('document', { baseURI: 'http://localhost/' })
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('fetchDownloadUsers', () => {
  it('requests the room-filtered users endpoint and stores the list', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      headers: new Headers({ 'Content-Type': 'application/json' }),
      json: async () => users,
    })
    vi.stubGlobal('fetch', fetchMock)

    const store = makeStore()
    await store.dispatch(fetchDownloadUsers(1))

    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost/api/users/names?roomId=1',
      expect.anything(),
    )
    expect(store.getState().youtube.downloadUsers).toEqual(users)
  })

  it('fails silently keeping an empty list', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('down')))

    const store = makeStore()
    await store.dispatch(fetchDownloadUsers(null))

    expect(store.getState().youtube.downloadUsers).toEqual([])
    expect(store.getState().youtube.error).toBeNull()
  })
})

describe('hasSearched', () => {
  it('tracks completed searches and resets on clear', () => {
    const store = makeStore()

    expect(store.getState().youtube.hasSearched).toBe(false)

    store.dispatch(searchYoutubeVideos.pending('req1', 'abba'))
    store.dispatch(searchYoutubeVideos.fulfilled([], 'req1', 'abba'))
    expect(store.getState().youtube.hasSearched).toBe(true)

    store.dispatch(clearYoutubeResults())
    expect(store.getState().youtube.hasSearched).toBe(false)
  })

  it('ignores stale responses from cancelled searches', () => {
    const store = makeStore()

    store.dispatch(searchYoutubeVideos.pending('req1', 'abba'))
    store.dispatch(clearYoutubeResults())
    store.dispatch(searchYoutubeVideos.fulfilled([fullResult('x')], 'req1', 'abba'))

    expect(store.getState().youtube.results).toEqual([])
    expect(store.getState().youtube.hasSearched).toBe(false)
    expect(store.getState().youtube.isSearching).toBe(false)
  })

  it('ignores stale responses from superseded searches', () => {
    const store = makeStore()

    store.dispatch(searchYoutubeVideos.pending('req1', 'abba'))
    store.dispatch(searchYoutubeVideos.pending('req2', 'queen'))
    store.dispatch(searchYoutubeVideos.fulfilled([fullResult('x')], 'req1', 'abba'))

    expect(store.getState().youtube.results).toEqual([])
    expect(store.getState().youtube.hasSearched).toBe(false)
  })

  it('ignores stale failures from cancelled searches', () => {
    const store = makeStore()

    store.dispatch(searchYoutubeVideos.pending('req1', 'abba'))
    store.dispatch(clearYoutubeResults())
    store.dispatch(searchYoutubeVideos.rejected(new Error('boom'), 'req1', 'abba'))

    expect(store.getState().youtube.error).toBeNull()
    expect(store.getState().youtube.hasSearched).toBe(false)
  })
})
