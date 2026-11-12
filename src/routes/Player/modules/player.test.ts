import { afterEach, describe, expect, it, vi } from 'vitest'
import { configureStore } from '@reduxjs/toolkit'
import socket from 'lib/socket'
import { PLAYER_CMD_OPTIONS, PLAYER_EMIT_STATUS, PLAYER_STATUS } from 'shared/actionTypes.js'
import { roomSwitched } from 'store/modules/status'
import playerReducer, { playerLoad, playerLoadCurrent, playerStatus, playerUpdate } from './player'
import type { QueueItem } from 'shared/types'

// hoisted above the import above: the engine subclasses AudioWorkletNode at
// module scope, which doesn't exist outside a browser. The reducer only ever
// needs isSupported().
vi.mock('lib/pitchShifter', () => ({
  pitchShifterEngine: { isSupported: () => true },
}))

// the reducer's initialState reflects the browser's actual capabilities, so
// isPitchSupported is set explicitly by every case below
const stateWith = (overrides: Record<string, unknown>) => playerReducer(
  undefined,
  playerUpdate({ isPitchSupported: true, ...overrides }),
)

describe('playerLoad', () => {
  it('applies the media\'s default pitch', () => {
    const state = playerReducer(stateWith({}), playerLoad({ queueId: 1, pitch: 3 }))

    expect(state.pitch).toBe(3)
    expect(state._isFetching).toBe(true)
  })

  it('leaves the pitch alone when the same item loads again', () => {
    // a load fires again once mediaSrc resolves; a pitch set while waiting
    // shouldn't be discarded by it
    let state = playerReducer(stateWith({}), playerLoad({ queueId: 1, pitch: 3 }))
    state = playerReducer(state, playerUpdate({ pitch: -2 }))
    state = playerReducer(state, playerLoad({ queueId: 1, pitch: 3 }))

    expect(state.pitch).toBe(-2)
  })

  it('applies the default of the next item', () => {
    let state = playerReducer(stateWith({}), playerLoad({ queueId: 1, pitch: 3 }))
    state = playerReducer(state, playerLoad({ queueId: 2, pitch: -4 }))

    expect(state.pitch).toBe(-4)
  })

  it('resets to 0 when the next item has no default', () => {
    let state = playerReducer(stateWith({}), playerLoad({ queueId: 1, pitch: 3 }))
    state = playerReducer(state, playerLoad({ queueId: 2, pitch: 0 }))

    expect(state.pitch).toBe(0)
  })

  it('ignores the default when pitch shifting is unsupported', () => {
    // otherwise every client's status would report a pitch the audio never got
    const state = playerReducer(
      stateWith({ isPitchSupported: false }),
      playerLoad({ queueId: 1, pitch: 3 }),
    )

    expect(state.pitch).toBe(0)
  })

  it('clears any error from the previous item', () => {
    const state = playerReducer(
      stateWith({ errorMessage: 'nope', isErrored: true }),
      playerLoad({ queueId: 1, pitch: 0 }),
    )

    expect(state.isErrored).toBe(false)
    expect(state.errorMessage).toBe('')
  })
})

describe('playerLoadCurrent', () => {
  // the thunk reads only player.queueId and that item from the queue
  const loadWith = (item?: Partial<QueueItem> | { isOptimistic: true }) => {
    const dispatch = vi.fn()
    const getState = () => ({
      player: { queueId: 1 },
      queue: { result: item ? [1] : [], entities: item ? { 1: item } : {} },
    })

    playerLoadCurrent()(dispatch, getState as never, undefined)

    return dispatch.mock.calls[0][0].payload.pitch
  }

  it('prefers the singer\'s saved pitch over the media default', () => {
    expect(loadWith({ pitch: 4, userPitch: 2 })).toBe(2)
  })

  it('treats a saved 0 as a preference, not the absence of one', () => {
    expect(loadWith({ pitch: 4, userPitch: 0 })).toBe(0)
  })

  it('falls back to the media default without a saved pitch', () => {
    expect(loadWith({ pitch: 4, userPitch: null })).toBe(4)
  })

  it('uses 0 when neither is set', () => {
    expect(loadWith({ pitch: null, userPitch: null })).toBe(0)
  })

  it('uses 0 for an optimistic item, which has no media yet', () => {
    expect(loadWith({ isOptimistic: true })).toBe(0)
  })

  it('uses 0 when the item is gone', () => {
    expect(loadWith()).toBe(0)
  })
})

describe('playerCmdOptions', () => {
  it('stores the requested pitch without changing display options', () => {
    const state = playerReducer(undefined, {
      type: PLAYER_CMD_OPTIONS,
      payload: { pitch: -2 },
    })

    expect(state.pitch).toBe(-2)
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
    expect(off.pitch).toBe(initial.pitch)

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
      payload: { pitch: 2 },
    })
    expect(dirty.pitch).toBe(2)

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
