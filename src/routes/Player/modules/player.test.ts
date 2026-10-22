import { afterEach, describe, expect, it, vi } from 'vitest'
import { configureStore } from '@reduxjs/toolkit'
import socket from 'lib/socket'
import { PLAYER_CMD_OPTIONS, PLAYER_EMIT_STATUS, PLAYER_STATUS } from 'shared/actionTypes.js'
import { roomSwitched } from 'store/modules/status'
import playerReducer, { playerStatus } from './player'

describe('playerCmdOptions', () => {
  it('stores the requested pitch without changing display options', () => {
    const state = playerReducer(undefined, {
      type: PLAYER_CMD_OPTIONS,
      payload: { pitchSemitones: -2 },
    })

    expect(state.pitchSemitones).toBe(-2)
    expect(state.cdgAlpha).toBe(0.5)
    expect(state.cdgSize).toBe(0.65)
    expect(state.mp4Alpha).toBe(0.5)
  })

  it('enables ReplayGain by default and toggles it per player', () => {
    const initial = playerReducer(undefined, { type: '@@INIT' } as never)
    expect(initial.isReplayGainEnabled).toBe(true)

    const off = playerReducer(initial, {
      type: PLAYER_CMD_OPTIONS,
      payload: { isReplayGainEnabled: false },
    })
    expect(off.isReplayGainEnabled).toBe(false)
    expect(off.pitchSemitones).toBe(initial.pitchSemitones)

    const on = playerReducer(off, {
      type: PLAYER_CMD_OPTIONS,
      payload: { isReplayGainEnabled: true },
    })
    expect(on.isReplayGainEnabled).toBe(true)
  })
})

describe('switchRoom', () => {
  it('resets room-scoped player state', () => {
    const dirty = playerReducer(undefined, {
      type: PLAYER_CMD_OPTIONS,
      payload: { pitchSemitones: 2 },
    })
    expect(dirty.pitchSemitones).toBe(2)

    const reset = playerReducer(dirty, roomSwitched())
    expect(reset).toEqual(playerReducer(undefined, { type: '@@INIT' } as never))
  })
})

describe('playerStatus', () => {
  const makeStore = () => {
    const actions: { type: string, payload?: unknown, meta?: unknown }[] = []
    const store = configureStore({
      reducer: {
        player: playerReducer,
        playerVisualizer: (state = {}) => state,
      },
      middleware: gdm => gdm({ serializableCheck: false, immutableCheck: false })
        .concat(() => (next: (action: { type: string }) => unknown) => (action: { type: string, payload?: unknown, meta?: unknown }) => {
          actions.push(action)
          return next(action)
        }),
    })

    return {
      // the test store's state type doesn't match RootState: cast the
      // dispatch so the thunks accept it
      store: {
        dispatch: store.dispatch as unknown as (action: import('store/store').AppThunk) => Promise<unknown>,
        getState: store.getState,
      },
      actions,
    }
  }

  const setConnection = (connected: boolean, onLine = true) => {
    ;(socket as { connected: boolean }).connected = connected
    vi.stubGlobal('navigator', { onLine })
  }

  afterEach(() => {
    vi.unstubAllGlobals()
    ;(socket as { connected: boolean }).connected = false
  })

  it('online: emits the full status to the room (throttled)', async () => {
    setConnection(true)
    const { store, actions } = makeStore()

    await store.dispatch(playerStatus({ isPlaying: true, queueId: 3 }))

    const emit = actions.find(a => a.type === PLAYER_EMIT_STATUS)
    expect(emit).toBeDefined()
    expect((emit?.payload as { isPlaying: boolean }).isPlaying).toBe(true)
    expect((emit?.payload as { queueId: number }).queueId).toBe(3)
    expect(emit?.meta).toMatchObject({ throttle: { wait: 1000 } })
    // no local mirror when the server echo would deliver it
    expect(actions.some(a => a.type === PLAYER_STATUS)).toBe(false)
  })

  it('offline: updates the local status mirror and skips the emit', async () => {
    setConnection(false)
    const { store, actions } = makeStore()

    await store.dispatch(playerStatus({ isPlaying: true, queueId: 3 }))

    const mirror = actions.find(a => a.type === PLAYER_STATUS)
    expect(mirror).toBeDefined()
    expect((mirror?.payload as { isPlaying: boolean }).isPlaying).toBe(true)
    expect((mirror?.payload as { queueId: number }).queueId).toBe(3)
    expect((mirror?.payload as { isPlayerPresent?: boolean }).isPlayerPresent).toBeUndefined()
    expect(actions.some(a => a.type === PLAYER_EMIT_STATUS)).toBe(false)
  })

  it('offline: private properties never reach the mirror', async () => {
    setConnection(false)
    const { store, actions } = makeStore()

    await store.dispatch(playerStatus({ _isFetching: true, isPlaying: false }))

    const mirror = actions.find(a => a.type === PLAYER_STATUS)
    expect(mirror).toBeDefined()
    expect(Object.keys(mirror?.payload as object).some(key => key.startsWith('_'))).toBe(false)
  })
})
