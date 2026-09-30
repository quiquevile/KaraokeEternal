import { describe, it, expect } from 'vitest'
import { configureStore } from '@reduxjs/toolkit'
import reducer, { toggleSongStarred } from './userStars'

const makeStore = () => configureStore({ reducer: { userStars: reducer } })

describe('toggleSongStarred', () => {
  it('stars and unstars without touching other entries', async () => {
    const store = makeStore()

    await store.dispatch(toggleSongStarred(5))
    await store.dispatch(toggleSongStarred(9))
    expect(store.getState().userStars.starredSongs).toEqual([5, 9])

    await store.dispatch(toggleSongStarred(5))
    expect(store.getState().userStars.starredSongs).toEqual([9])

    // star again after unstarring
    await store.dispatch(toggleSongStarred(5))
    expect(store.getState().userStars.starredSongs).toEqual([9, 5])
  })
})
