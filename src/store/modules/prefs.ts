import { createAction, createAsyncThunk, createReducer } from '@reduxjs/toolkit'
import { RootState } from 'store/store'
import type { Path, Role } from 'shared/types'
import {
  PREFS_RECEIVE,
  PREFS_REQUEST,
  PREFS_SET,
  PREFS_PATH_UPDATE,
  PREFS_PATH_SET_PRIORITY,
  PREFS_PUSH,
  PREFS_REQ_SCANNER_START,
  PREFS_REQ_SCANNER_STOP,
  PREFS_REQ_GAIN_START,
  SCANNER_WORKER_STATUS,
  LOGOUT,
} from 'shared/actionTypes'

import HttpApi from 'lib/HttpApi'
const api = new HttpApi('prefs')

// ------------------------------------
// Actions
// ------------------------------------
const logout = createAction(LOGOUT)
export const setPref = createAction<{ key: string, data: unknown }>(PREFS_SET)
export const receivePrefs = createAction<object>(PREFS_RECEIVE)
export const setPathPriority = createAction<number[]>(PREFS_PATH_SET_PRIORITY)
const prefsPush = createAction<PrefsState>(PREFS_PUSH)
const scannerWorkerStatus = createAction<{ isScanning: boolean, pct: number, text: string, job?: string }>(SCANNER_WORKER_STATUS)

export const setPathPrefs = createAsyncThunk(
  PREFS_PATH_UPDATE,
  async ({
    pathId,
    data,
  }: {
    pathId: number
    data: FormData
  }, thunkAPI) => {
    const response = await api.put(`/path/${pathId}`, {
      body: data,
    })

    thunkAPI.dispatch(receivePrefs(response))
  },
)

export const fetchPrefs = createAsyncThunk<object, void, { state: RootState }>(
  PREFS_REQUEST,
  async (_, thunkAPI) => {
    const response = await api.get('')

    // sign out if we see isFirstRun flag
    if (response.isFirstRun && thunkAPI.getState().user.userId !== null) {
      thunkAPI.dispatch(logout())
    }

    return response
  },
)

export const requestScan = createAsyncThunk(
  PREFS_REQ_SCANNER_START,
  async (pathId: number) => await api.get(`/path/${pathId}/scan`),
)

export const requestScanAll = createAsyncThunk(
  PREFS_REQ_SCANNER_START,
  async () => await api.get('/paths/scan'),
)

export const requestScanStop = createAsyncThunk(
  PREFS_REQ_SCANNER_STOP,
  async () => await api.get('/paths/scan/stop'),
)

export const requestGainScan = createAsyncThunk(
  PREFS_REQ_GAIN_START,
  async () => await api.get('/gain/scan'),
)

export interface GainStatus {
  active: boolean
  paused: boolean
  measured: number
  tagged: number
  skipped: number
  total: number
  pct: number
  text: string | null
}

export const fetchGainStatus = createAsyncThunk(
  'prefs/fetchGainStatus',
  async () => await api.get('/gain/status') as GainStatus,
)

export type EqPresetSlot = 'P1' | 'P2' | 'P3'

// the caller's own EQ preset slots (per-user storage, never shared)
export const fetchEqPresets = createAsyncThunk(
  'prefs/fetchEqPresets',
  async (_, thunkAPI) => {
    const response = await api.get('/eq-presets') as Partial<Record<EqPresetSlot, number[]>>

    thunkAPI.dispatch(receivePrefs({ eqPresets: response }))

    return response
  },
)

// persist one of the caller's own EQ preset slots (admins or playback
// controllers); the response carries the whole merged map
export const saveEqPreset = createAsyncThunk(
  'prefs/saveEqPreset',
  async ({ name, gains }: { name: EqPresetSlot, gains: number[] }, thunkAPI) => {
    const response = await api.put('/eq-presets', {
      body: { name, gains },
    }) as Record<EqPresetSlot, number[]>

    thunkAPI.dispatch(receivePrefs({ eqPresets: response }))
  },
)

// ------------------------------------
// Reducer
// ------------------------------------
export interface PrefsState {
  isFirstRun?: boolean
  isScanning: boolean
  paths: {
    result: number[]
    entities: Record<number, Path>
  }
  roles: {
    result: number[]
    entities: Record<number, Role>
  }
  scannerPct: number
  scannerText: string
  scannerJob: string | null
  youtubeDownloadPathId?: number
  youtubeYtdlDir?: string
  youtubeDlExtraArgs?: string
  eqPresets?: Partial<Record<EqPresetSlot, number[]>>
}

const initialState: PrefsState = {
  isScanning: false,
  paths: {
    result: [],
    entities: {},
  },
  roles: {
    result: [],
    entities: {},
  },
  scannerPct: 0,
  scannerText: '',
  scannerJob: null,
}

const prefsReducer = createReducer(initialState, (builder) => {
  builder
    .addCase(fetchPrefs.fulfilled, (state, { payload }) => ({
      ...state,
      ...payload,
    }))
    .addCase(receivePrefs, (state, { payload }) => ({
      ...state,
      ...payload,
    }))
    .addCase(prefsPush, (state, { payload }) => ({
      ...state,
      ...payload,
    }))
    .addCase(scannerWorkerStatus, (state, { payload }) => ({
      ...state,
      isScanning: payload.isScanning,
      scannerPct: payload.pct,
      scannerText: payload.text,
      scannerJob: payload.job ?? null,
    }))
    .addCase(fetchGainStatus.fulfilled, (state, { payload }) => {
      // a reconnecting client re-discovers a running gain job; idle means
      // nothing to show (a finished job reports itself through the socket)
      if (!payload?.active) return

      state.isScanning = true
      state.scannerPct = payload.pct
      state.scannerText = payload.text ?? ''
      state.scannerJob = 'gain'
    })
    .addCase(logout, (state) => {
      // drop scan progress with the session: a re-login re-discovers any
      // still-running job instead of showing a dead one
      state.isScanning = false
      state.scannerPct = 0
      state.scannerText = ''
      state.scannerJob = null
    })
})

export default prefsReducer
