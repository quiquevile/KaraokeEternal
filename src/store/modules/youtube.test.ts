import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { configureStore } from '@reduxjs/toolkit'
import reducer, { fetchDownloadUsers } from './youtube'

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
  it('requests the root users endpoint and stores the list', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      headers: new Headers({ 'Content-Type': 'application/json' }),
      json: async () => users,
    })
    vi.stubGlobal('fetch', fetchMock)

    const store = makeStore()
    await store.dispatch(fetchDownloadUsers())

    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost/api/users/names',
      expect.anything(),
    )
    expect(store.getState().youtube.downloadUsers).toEqual(users)
  })

  it('fails silently keeping an empty list', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('down')))

    const store = makeStore()
    await store.dispatch(fetchDownloadUsers())

    expect(store.getState().youtube.downloadUsers).toEqual([])
    expect(store.getState().youtube.error).toBeNull()
  })
})
