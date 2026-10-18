import { describe, it, expect } from 'vitest'
import { configureStore } from '@reduxjs/toolkit'
import reducer, { toggleSongFlawed } from './userFlaws'

const makeStore = () => configureStore({ reducer: { userFlaws: reducer } })

// the toggle thunk is typed against the full RootState; the test store
// only holds its slice, so dispatch through an untyped handle
const toggle = (store: ReturnType<typeof makeStore>, songId: number) => (
  store.dispatch as unknown as (action: unknown) => Promise<unknown>
)(toggleSongFlawed(songId))

describe('toggleSongFlawed', () => {
  it('flaws and unflaws without touching other entries', async () => {
    const store = makeStore()

    await toggle(store, 5)
    await toggle(store, 9)
    expect(store.getState().userFlaws.flawedSongs).toEqual([5, 9])

    await toggle(store, 5)
    expect(store.getState().userFlaws.flawedSongs).toEqual([9])

    // flaw again after unflawing
    await toggle(store, 5)
    expect(store.getState().userFlaws.flawedSongs).toEqual([9, 5])
  })
})
