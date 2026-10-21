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
    await api.put(`artist/${artistId}`, {
      body: { artist },
    })
    thunkAPI.dispatch(closeArtistEditor())
  },
)

// ------------------------------------
// Reducer
// ------------------------------------
export interface ArtistInfoState {
  editorArtistId: number | null
  error: string | null
}

const initialState: ArtistInfoState = {
  editorArtistId: null,
  error: null,
}

const artistInfoReducer = createReducer(initialState, (builder) => {
  builder
    .addCase(showArtistEditor, (state, { payload }) => {
      state.editorArtistId = payload
      state.error = null
    })
    .addCase(closeArtistEditor, (state) => {
      state.editorArtistId = null
    })
    .addCase(updateArtist.rejected, (state, action) => {
      state.error = action.error.message ?? 'could not save artist'
    })
})

export default artistInfoReducer
