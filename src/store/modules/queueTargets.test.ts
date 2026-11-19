import { configureStore } from '@reduxjs/toolkit'
import { afterEach, describe, expect, it, vi } from 'vitest'
import queueTargets, { fetchQueueUsers } from './queueTargets'

afterEach(() => vi.unstubAllGlobals())

describe('fetchQueueUsers', () => {
  it('keeps the room and ghost account picker available', async () => {
    const users = [{ userId: 2, username: 'pepe', name: 'Pepe' }]
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      headers: new Headers({ 'Content-Type': 'application/json' }),
      json: async () => users,
    })
    vi.stubGlobal('document', { baseURI: 'http://localhost/' })
    vi.stubGlobal('fetch', fetchMock)

    const store = configureStore({ reducer: { queueTargets } })
    await store.dispatch(fetchQueueUsers(1))

    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost/api/users/names?roomId=1&for=queue&ghosts=1',
      expect.anything(),
    )
    expect(store.getState().queueTargets.queueUsers).toEqual(users)
  })

  it('falls back to an empty list when the request fails', async () => {
    vi.stubGlobal('document', { baseURI: 'http://localhost/' })
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('down')))

    const store = configureStore({ reducer: { queueTargets } })
    await store.dispatch(fetchQueueUsers(null))

    expect(store.getState().queueTargets.queueUsers).toEqual([])
  })
})
