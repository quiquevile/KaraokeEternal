import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { configureStore } from '@reduxjs/toolkit'
import { LOGOUT, PREFS_PUSH } from 'shared/actionTypes.js'
import reducer, { fetchEqPresets, fetchGainStatus, saveEqPreset } from './prefs'

const gains = [5, 4, 3, 2, 1, 0, 0, 1, 2, 3]

const makeStore = () => configureStore({ reducer: { prefs: reducer } })

beforeEach(() => {
  vi.stubGlobal('document', { baseURI: 'http://localhost/' })
})

afterEach(() => {
  vi.unstubAllGlobals()
})

const activeStatus = {
  active: true,
  paused: false,
  measured: 3,
  tagged: 0,
  skipped: 0,
  total: 10,
  pct: 30,
  text: 'Measuring loudness (3/10)',
}

describe('prefs gain status', () => {
  it('populates scan progress from an active job', () => {
    const state = reducer(undefined, fetchGainStatus.fulfilled(activeStatus, ''))

    expect(state).toMatchObject({
      isScanning: true,
      scannerPct: 30,
      scannerText: 'Measuring loudness (3/10)',
      scannerJob: 'gain',
    })
  })

  it('ignores idle status', () => {
    const state = reducer(undefined, fetchGainStatus.fulfilled({ ...activeStatus, active: false }, ''))

    expect(state.isScanning).toBe(false)
  })

  it('clears scan progress on logout', () => {
    const running = reducer(undefined, fetchGainStatus.fulfilled(activeStatus, ''))
    expect(running.isScanning).toBe(true)

    const state = reducer(running, { type: LOGOUT })

    expect(state).toMatchObject({
      isScanning: false,
      scannerPct: 0,
      scannerText: '',
      scannerJob: null,
    })
  })
})

describe('prefs eq presets', () => {
  it('merges pushed slots', () => {
    const store = makeStore()

    store.dispatch({ type: PREFS_PUSH, payload: { eqPresets: { P1: gains } } })

    expect(store.getState().prefs.eqPresets).toEqual({ P1: gains })
  })

  it('loads the caller’s own slots', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      headers: new Headers({ 'Content-Type': 'application/json' }),
      json: async (): Promise<unknown> => ({ P2: gains }),
    })
    vi.stubGlobal('fetch', fetchMock)
    const store = makeStore()

    const action = await store.dispatch(fetchEqPresets())

    expect(fetchEqPresets.fulfilled.match(action)).toBe(true)
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/api/prefs/eq-presets'),
      expect.objectContaining({ method: 'GET' }),
    )
    expect(store.getState().prefs.eqPresets).toEqual({ P2: gains })
  })

  it('persists a slot through the thunk', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      headers: new Headers({ 'Content-Type': 'application/json' }),
      json: async (): Promise<unknown> => ({ P1: gains }),
    })
    vi.stubGlobal('fetch', fetchMock)
    const store = makeStore()

    const action = await store.dispatch(saveEqPreset({ name: 'P1', gains }))

    expect(saveEqPreset.fulfilled.match(action)).toBe(true)
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/api/prefs/eq-presets'),
      expect.objectContaining({ method: 'PUT' }),
    )
    expect(store.getState().prefs.eqPresets).toEqual({ P1: gains })
  })

  it('leaves stored slots alone when saving fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('boom')))
    const store = makeStore()

    const action = await store.dispatch(saveEqPreset({ name: 'P1', gains }))

    expect(saveEqPreset.rejected.match(action)).toBe(true)
    expect(store.getState().prefs.eqPresets).toBeUndefined()
  })
})
