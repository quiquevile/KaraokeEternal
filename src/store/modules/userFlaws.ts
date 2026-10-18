import { createAction, createAsyncThunk, createReducer } from '@reduxjs/toolkit'
import { REHYDRATE } from 'redux-persist'
import { ensureState } from 'redux-optimistic-ui'
import {
  ACCOUNT_RECEIVE,
  FLAW_SONG,
  UNFLAW_SONG,
  SONG_FLAWED,
  SONG_UNFLAWED,
  FLAWS_PUSH,
  SOCKET_AUTH_ERROR,
  LOGOUT,
} from 'shared/actionTypes'
import { RootState } from 'store/store'

// ------------------------------------
// Actions
// ------------------------------------
export const toggleSongFlawed = createAsyncThunk<void, number, { state: RootState }>(
  'userFlaws/toggleSongFlawed',
  async (songId, { dispatch, getState }) => {
    const flawedSongs = ensureState(getState().userFlaws).flawedSongs
    if (flawedSongs.includes(songId)) {
      dispatch(unflawSong(songId))
    } else {
      dispatch(flawSong(songId))
    }
  },
)

const flawSong = createAction(FLAW_SONG, (songId: number) => ({
  payload: { songId },
  meta: { isOptimistic: true },
}))

const unflawSong = createAction(UNFLAW_SONG, (songId: number) => ({
  payload: { songId },
  meta: { isOptimistic: true },
}))

const songFlawed = createAction<{ userId: number, songId: number }>(SONG_FLAWED)
const songUnflawed = createAction<{ userId: number, songId: number }>(SONG_UNFLAWED)
const flawsPush = createAction<UserFlawsState>(FLAWS_PUSH)
const accountReceive = createAction<{ userId: number }>(ACCOUNT_RECEIVE)

// ------------------------------------
// Reducer
// ------------------------------------
export interface UserFlawsState {
  userId: number | null
  flawedSongs: number[]
}

const initialState: UserFlawsState = {
  userId: null,
  flawedSongs: [],
}

const userFlawsReducer = createReducer(initialState, (builder) => {
  builder
    .addCase(flawSong, (state, { payload }) => {
      // optimistic
      if (!state.flawedSongs.includes(payload.songId)) {
        state.flawedSongs.push(payload.songId)
      }
    })
    .addCase(unflawSong, (state, { payload }) => {
      // optimistic (splice(-1) would eat the last element, so guard)
      const index = state.flawedSongs.indexOf(payload.songId)

      if (index !== -1) {
        state.flawedSongs.splice(index, 1)
      }
    })
    .addCase(songFlawed, (state, { payload }) => {
      if (payload.userId === state.userId && !state.flawedSongs.includes(payload.songId)) {
        state.flawedSongs.push(payload.songId)
      }
    })
    .addCase(songUnflawed, (state, { payload }) => {
      if (payload.userId === state.userId && state.flawedSongs.includes(payload.songId)) {
        state.flawedSongs.splice(state.flawedSongs.indexOf(payload.songId), 1)
      }
    })
    .addCase(flawsPush, (state, { payload }) => ({
      ...state,
      ...payload,
    }))
    .addCase(accountReceive, (state, { payload }) => {
      state.userId = payload.userId
    })
    // @ts-expect-error: payload exists; action type appears to be erroneous
    .addCase(REHYDRATE, (state, { payload }) => {
      if (typeof payload?.userId === 'number') {
        state.userId = payload.userId
      }
    })
    .addCase(LOGOUT, () => ({
      ...initialState,
    }))
    .addCase(SOCKET_AUTH_ERROR, () => ({
      ...initialState,
    }))
})

export default userFlawsReducer
