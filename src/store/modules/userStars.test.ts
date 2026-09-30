import { describe, it, expect } from 'vitest'
import { configureStore } from '@reduxjs/toolkit'
import reducer, { toggleSongStarred } from './userStars'

const makeStore = () => configureStore({ reducer: { userStars: reducer } })

// the toggle thunk is typed against the full RootState; the test store
// only holds its slice, so dispatch through an untyped handle
const toggle = (store: ReturnType<typeof makeStore>, songId: number) => (
  store.dispatch as unknown as (action: unknown) => Promise<unknown>
)(toggleSongStarred(songId))

describe('toggleSongStarred', () => {
  it('stars and unstars without touching other entries', async () => {
    const store = makeStore()

    await toggle(store, 5)
    await toggle(store, 9)
    expect(store.getState().userStars.starredSongs).toEqual([5, 9])

    await toggle(store, 5)
    expect(store.getState().userStars.starredSongs).toEqual([9])

    // star again after unstarring
    await toggle(store, 5)
    expect(store.getState().userStars.starredSongs).toEqual([9, 5])
  })
})
