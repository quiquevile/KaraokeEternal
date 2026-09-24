import { createAction, createAsyncThunk, createReducer } from '@reduxjs/toolkit'
import HttpApi from 'lib/HttpApi'
import {
  SONG_INFO_REQUEST,
  SONG_INFO_SET_PREFERRED,
  SONG_INFO_CLOSE,
  SONG_INFO_SHOW_EDITOR,
  SONG_INFO_CLOSE_EDITOR,
  SONG_INFO_UPDATE,
  SONG_INFO_SHOW_DELETE,
  SONG_INFO_CLOSE_DELETE,
  SONG_INFO_DELETE,
  SONG_INFO_FETCH_MEDIA,
  SONG_INFO_DELETE_MEDIA,
  SONG_INFO_SET_MEDIA_GAIN,
} from 'shared/actionTypes'
import { Media } from 'shared/types'

const api = new HttpApi()

// ------------------------------------
// Actions
// ------------------------------------
export const showSongInfo = createAsyncThunk(
  SONG_INFO_REQUEST,
  async (songId: number) => await api.get<{ result: number[], entities: Media[] }>(`song/${songId}`),
)

export const closeSongInfo = createAction(SONG_INFO_CLOSE)

export const showSongEditor = createAction<number>(SONG_INFO_SHOW_EDITOR)
export const closeSongEditor = createAction(SONG_INFO_CLOSE_EDITOR)

export const showDeleteSong = createAction<number>(SONG_INFO_SHOW_DELETE)
export const closeDeleteSong = createAction(SONG_INFO_CLOSE_DELETE)

export const deleteSong = createAsyncThunk(
  SONG_INFO_DELETE,
  async (songId: number, thunkAPI) => {
    await api.delete(`song/${songId}`)
    thunkAPI.dispatch(closeDeleteSong())
  },
)

export const fetchSongMedia = createAsyncThunk(
  SONG_INFO_FETCH_MEDIA,
  async (songId: number) => await api.get<{ result: number[], entities: Record<number, Media> }>(`song/${songId}`),
)

export const deleteMedia = createAsyncThunk(
  SONG_INFO_DELETE_MEDIA,
  async (mediaIds: number[], thunkAPI) => {
    for (const mediaId of mediaIds) {
      await api.delete(`media/${mediaId}`)
    }

    thunkAPI.dispatch(closeDeleteSong())
  },
)

export const setMediaGain = createAsyncThunk(
  SONG_INFO_SET_MEDIA_GAIN,
  async ({ songId, mediaId, rgTrackGain }: { songId: number, mediaId: number, rgTrackGain: number | null }, thunkAPI) => {
    await api.put(`media/${mediaId}`, {
      body: { rgTrackGain },
    })
    thunkAPI.dispatch(showSongInfo(songId))
  },
)

export const updateSong = createAsyncThunk(
  SONG_INFO_UPDATE,
  async ({
    songId,
    artist,
    title,
  }: {
    songId: number
    artist: string
    title: string
  }, thunkAPI) => {
    await api.put(`song/${songId}`, {
      body: { artist, title },
    })
    thunkAPI.dispatch(closeSongEditor())
  },
)

export const setPreferredSong = createAsyncThunk(
  SONG_INFO_SET_PREFERRED,
  async ({
    songId,
    mediaId,
    isPreferred,
  }: Pick<Media, 'songId' | 'mediaId' | 'isPreferred'>, thunkAPI) => {
    await api.request(isPreferred ? 'PUT' : 'DELETE', `media/${mediaId}/prefer`)
    thunkAPI.dispatch(showSongInfo(songId))
  },
)

// ------------------------------------
// Reducer
// ------------------------------------
interface SongInfoState {
  isLoading: boolean
  isVisible: boolean
  songId: number | null
  editorSongId: number | null
  deleteSongId: number | null
  media: { result: number[], entities: Record<number, Media> }
}

const initialState: SongInfoState = {
  isLoading: false,
  isVisible: false,
  songId: null,
  editorSongId: null,
  deleteSongId: null,
  media: { result: [], entities: {} },
}

const songInfoReducer = createReducer(initialState, (builder) => {
  builder
    .addCase(showSongInfo.pending, (state, { meta }) => {
      state.isLoading = true
      state.isVisible = true
      state.songId = meta.arg
    })
    .addCase(showSongInfo.fulfilled, (state, { payload }) => {
      state.isLoading = false
      state.media = payload
    })
    .addCase(showSongInfo.rejected, (state) => {
      state.isLoading = false
      state.isVisible = false
    })
    .addCase(closeSongInfo, (state) => {
      state.isVisible = false
    })
    .addCase(showSongEditor, (state, { payload }) => {
      state.editorSongId = payload
    })
    .addCase(closeSongEditor, (state) => {
      state.editorSongId = null
    })
    .addCase(showDeleteSong, (state, { payload }) => {
      state.deleteSongId = payload
    })
    .addCase(closeDeleteSong, (state) => {
      state.deleteSongId = null
    })
    .addCase(fetchSongMedia.fulfilled, (state, { payload }) => {
      state.media = payload
    })
})

export default songInfoReducer
