import { describe, it, expect } from 'vitest'
import { configureStore } from '@reduxjs/toolkit'
import reducer, {
  closeArtistEditor,
  showArtistEditor,
  updateArtist,
} from './artistInfo'

const makeStore = () => configureStore({ reducer: { artistInfo: reducer } })

describe('artistInfo editor', () => {
  it('opens with a cleared error and surfaces update failures in the dialog', () => {
    const store = makeStore()

    store.dispatch(showArtistEditor(7))
    expect(store.getState().artistInfo.editorArtistId).toBe(7)
    expect(store.getState().artistInfo.error).toBeNull()

    store.dispatch(updateArtist.rejected(new Error('duplicate'), 'req1', { artistId: 7, artist: 'A' }))
    expect(store.getState().artistInfo.error).toBe('duplicate')
    // the dialog stays open so the clash can be corrected
    expect(store.getState().artistInfo.editorArtistId).toBe(7)

    store.dispatch(showArtistEditor(8))
    expect(store.getState().artistInfo.error).toBeNull()

    store.dispatch(closeArtistEditor())
    expect(store.getState().artistInfo.editorArtistId).toBeNull()
  })
})
