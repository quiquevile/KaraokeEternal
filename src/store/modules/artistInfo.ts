import { createAction, createAsyncThunk, createReducer } from '@reduxjs/toolkit'
import HttpApi from 'lib/HttpApi'
import {
  ARTIST_INFO_SHOW_EDITOR,
  ARTIST_INFO_CLOSE_EDITOR,
  ARTIST_INFO_UPDATE,
} from 'shared/actionTypes'

const api = new HttpApi()

// ------------------------------------
// Actions
// ------------------------------------
export const showArtistEditor = createAction<number>(ARTIST_INFO_SHOW_EDITOR)
export const closeArtistEditor = createAction(ARTIST_INFO_CLOSE_EDITOR)

export const updateArtist = createAsyncThunk(
  ARTIST_INFO_UPDATE,
  async ({
    artistId,
    artist,
  }: {
    artistId: number
    artist: string
  }, thunkAPI) => {
    const result = await api.put<{ artistId: number, skipped: string[] }>(`artist/${artistId}`, {
      body: { artist },
    })
    thunkAPI.dispatch(closeArtistEditor())
    return result
  },
)

// ------------------------------------
// Reducer
// ------------------------------------
export interface ArtistInfoState {
  editorArtistId: number | null
}

const initialState: ArtistInfoState = {
  editorArtistId: null,
}

const artistInfoReducer = createReducer(initialState, (builder) => {
  builder
    .addCase(showArtistEditor, (state, { payload }) => {
      state.editorArtistId = payload
    })
    .addCase(closeArtistEditor, (state) => {
      state.editorArtistId = null
    })
})

export default artistInfoReducer
