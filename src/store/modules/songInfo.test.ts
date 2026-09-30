import { describe, it, expect } from 'vitest'
import { configureStore } from '@reduxjs/toolkit'
import reducer, {
  deleteMedia,
  deleteSong,
  setMediaGain,
  setPreferredSong,
  showDeleteSong,
  showSongEditor,
  updateSong,
} from './songInfo'

const makeStore = () => configureStore({ reducer: { songInfo: reducer } })

describe('songInfo errors', () => {
  it('surfaces mutation failures in the open dialog', async () => {
    const store = makeStore()

    store.dispatch(showSongEditor(7))
    store.dispatch(updateSong.rejected(new Error('duplicate'), 'req1', { songId: 7, artist: 'a', title: 't' }))
    expect(store.getState().songInfo.error).toBe('duplicate')
    expect(store.getState().songInfo.editorSongId).toBe(7)

    store.dispatch(showDeleteSong(7))
    expect(store.getState().songInfo.error).toBeNull()

    store.dispatch(deleteSong.rejected(new Error('locked'), 'req2', 7))
    expect(store.getState().songInfo.error).toBe('locked')

    store.dispatch(deleteMedia.rejected(new Error('io'), 'req3', [3]))
    expect(store.getState().songInfo.error).toBe('io')

    store.dispatch(setMediaGain.rejected(
      new Error('bad gain'), 'req4', { songId: 7, mediaId: 3, rgTrackGain: 99 },
    ))
    expect(store.getState().songInfo.error).toBe('bad gain')

    store.dispatch(setPreferredSong.rejected(
      new Error('nope'), 'req5', { songId: 7, mediaId: 3, isPreferred: true },
    ))
    expect(store.getState().songInfo.error).toBe('nope')
  })
})
