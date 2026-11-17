import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { configureStore } from '@reduxjs/toolkit'
import reducer, {
  closeArtistEditor,
  showArtistEditor,
  updateArtist,
} from './artistInfo'

const makeStore = () => configureStore({ reducer: { artistInfo: reducer } })

beforeEach(() => {
  vi.stubGlobal('document', { baseURI: 'http://localhost/' })
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('artistInfo editor', () => {
  it('closes the dialog after a partial merge and returns skipped songs for the final alert', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      headers: new Headers({ 'Content-Type': 'application/json' }),
      json: async () => ({ artistId: 8, skipped: ['Blocked'] }),
    }))
    const store = makeStore()
    store.dispatch(showArtistEditor(7))
    const result = await store.dispatch(updateArtist({ artistId: 7, artist: 'Target' })).unwrap()
    expect(result).toEqual({ artistId: 8, skipped: ['Blocked'] })
    expect(store.getState().artistInfo.editorArtistId).toBeNull()
  })

  it('closes the dialog when every song was renamed', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      headers: new Headers({ 'Content-Type': 'application/json' }),
      json: async () => ({ artistId: 8, skipped: [] as string[] }),
    }))
    const store = makeStore()
    store.dispatch(showArtistEditor(7))
    await store.dispatch(updateArtist({ artistId: 7, artist: 'Target' })).unwrap()
    expect(store.getState().artistInfo.editorArtistId).toBeNull()
  })

  it('opens and closes the editor', () => {
    const store = makeStore()

    store.dispatch(showArtistEditor(7))
    expect(store.getState().artistInfo.editorArtistId).toBe(7)

    store.dispatch(showArtistEditor(8))
    expect(store.getState().artistInfo.editorArtistId).toBe(8)

    store.dispatch(closeArtistEditor())
    expect(store.getState().artistInfo.editorArtistId).toBeNull()
  })
})
