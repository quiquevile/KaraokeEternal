import { createAction, createReducer } from '@reduxjs/toolkit'
import { type PlayerVisualizerState } from 'routes/Player/modules/playerVisualizer'
import socket from 'lib/socket'
import type { AppThunk, RootState } from 'store/store'
import {
  PLAYER_CMD_NEXT,
  PLAYER_CMD_OPTIONS,
  PLAYER_CMD_PAUSE,
  PLAYER_CMD_PLAY,
  PLAYER_CMD_REPLAY,
  PLAYER_CMD_VOLUME,
  PLAYER_REQ_NEXT,
  PLAYER_REQ_OPTIONS,
  PLAYER_REQ_PAUSE,
  PLAYER_REQ_PLAY,
  PLAYER_REQ_REPLAY,
  PLAYER_REQ_VOLUME,
  PLAYER_STATUS,
  PLAYER_LEAVE,
} from 'shared/actionTypes'
import { MediaType, PlaybackOptions } from 'shared/types'
import { ROOM_SWITCHED } from 'shared/actionTypes'

// ------------------------------------
// Actions
// ------------------------------------
const playerStatus = createAction<object>(PLAYER_STATUS)
const playerLeave = createAction(PLAYER_LEAVE)

// room switch drops all room-scoped player state: the server only pushes
// fresh status if the new room has a player
export const roomSwitched = createAction(ROOM_SWITCHED)

// Playback commands normally round-trip through the server (REQ → CMD
// relayed to the room). While the connection is down the round-trip never
// comes back, so the player window applies the CMD locally instead; the
// REQ is skipped entirely (buffered REQs would replay on reconnect and
// e.g. skip songs). Controllers in other windows can't reach an absent
// player either way, so their behavior is unchanged.
const isPlayerOffline = (state: RootState): boolean =>
  state.player !== undefined && (!socket.connected || !navigator.onLine)

export const requestPlay = (): AppThunk => (dispatch, getState) => {
  dispatch({ type: isPlayerOffline(getState()) ? PLAYER_CMD_PLAY : PLAYER_REQ_PLAY })
}

export const requestPause = (): AppThunk => (dispatch, getState) => {
  dispatch({ type: isPlayerOffline(getState()) ? PLAYER_CMD_PAUSE : PLAYER_REQ_PAUSE })
}

export const requestPlayNext = (): AppThunk => (dispatch, getState) => {
  dispatch({ type: isPlayerOffline(getState()) ? PLAYER_CMD_NEXT : PLAYER_REQ_NEXT })
}

export const requestReplay = (queueId: number): AppThunk => (dispatch, getState) => {
  dispatch({
    type: isPlayerOffline(getState()) ? PLAYER_CMD_REPLAY : PLAYER_REQ_REPLAY,
    payload: { queueId },
  })
}

export const requestVolume = (vol: number): AppThunk => (dispatch, getState) => {
  dispatch({
    type: isPlayerOffline(getState()) ? PLAYER_CMD_VOLUME : PLAYER_REQ_VOLUME,
    payload: vol,
    meta: {
      throttle: {
        wait: 200,
        leading: false,
      },
    },
  })
}

export const requestOptions = (opts: PlaybackOptions): AppThunk => (dispatch, getState) => {
  dispatch({
    type: isPlayerOffline(getState()) ? PLAYER_CMD_OPTIONS : PLAYER_REQ_OPTIONS,
    payload: opts,
    meta: {
      throttle: {
        wait: 200,
        leading: true,
      },
    },
  })
}

// ------------------------------------
// Reducer
// ------------------------------------
export interface StatusState {
  cdgAlpha: number
  cdgSize: number
  eqEnabled: boolean
  eqGains: number[]
  eqPreset: string
  errorMessage: string
  historyJSON: string // queueIds in JSON array
  isAtQueueEnd: boolean
  isErrored: boolean
  isPlayerPresent: boolean
  isPlaying: boolean
  isReplayGainEnabled: boolean
  isVideoKeyingEnabled: boolean
  isWebGLSupported: boolean
  mediaType: MediaType | null
  mp4Alpha: number
  nextUserId: number | null
  pitchSemitones: number
  pitchSupported: boolean | null
  position: number
  queueId: number
  visualizer: PlayerVisualizerState | Record<string, never>
  volume: number
}

const initialState: StatusState = {
  cdgAlpha: 0,
  cdgSize: 0.8,
  eqEnabled: false,
  eqGains: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  eqPreset: 'Flat',
  errorMessage: '',
  historyJSON: '[]', // queueIds in JSON array
  isAtQueueEnd: false,
  isErrored: false,
  isPlayerPresent: false,
  isPlaying: false,
  isReplayGainEnabled: true,
  isVideoKeyingEnabled: false,
  isWebGLSupported: false,
  mediaType: null,
  mp4Alpha: 1,
  nextUserId: null,
  pitchSemitones: 0,
  pitchSupported: null,
  position: 0,
  queueId: -1,
  visualizer: {},
  volume: 1,
}

const statusReducer = createReducer(initialState, (builder) => {
  builder
    .addCase(playerLeave, (state) => {
      state.isPlayerPresent = false
    })
    .addCase(playerStatus, (state, { payload }) => ({
      ...state,
      ...payload,
      isPlayerPresent: true,
    }))
    .addCase(roomSwitched, () => ({
      ...initialState,
    }))
})

export default statusReducer
