import { afterEach, describe, expect, it, vi } from 'vitest'
import { configureStore } from '@reduxjs/toolkit'
import socket from 'lib/socket'
import {
  PLAYER_CMD_NEXT,
  PLAYER_CMD_OPTIONS,
  PLAYER_CMD_PAUSE,
  PLAYER_CMD_PLAY,
  PLAYER_CMD_REPLAY,
  PLAYER_CMD_VOLUME,
  PLAYER_LEAVE,
  PLAYER_REQ_NEXT,
  PLAYER_REQ_OPTIONS,
  PLAYER_REQ_PAUSE,
  PLAYER_REQ_PLAY,
  PLAYER_REQ_REPLAY,
  PLAYER_REQ_VOLUME,
  PLAYER_STATUS,
} from 'shared/actionTypes.js'
import type { PlaybackOptions } from 'shared/types'
import type { AppThunk } from 'store/store'
import statusReducer, {
  roomSwitched,
  requestOptions,
  requestPause,
  requestPlay,
  requestPlayNext,
  requestReplay,
  requestVolume,
} from './status'

interface RecordedAction {
  type: string
  payload?: unknown
  meta?: unknown
}

const makeStore = (withPlayer: boolean) => {
  const actions: RecordedAction[] = []
  const store = configureStore({
    reducer: {
      status: statusReducer,
      // the player slice is lazy-loaded: its presence marks the player window
      ...(withPlayer ? { player: (state = {}) => state } : {}),
    },
    middleware: gdm => gdm({ serializableCheck: false, immutableCheck: false })
      .concat(() => (next: (action: RecordedAction) => RecordedAction) => (action: RecordedAction) => {
        actions.push(action)
        return next(action)
      }),
  })

  return {
    // the test store's state type doesn't match RootState: cast the
    // dispatch so the thunks accept it
    store: {
      dispatch: store.dispatch as unknown as (action: AppThunk) => Promise<unknown>,
      getState: store.getState,
    },
    actions,
  }
}

const setConnection = (connected: boolean, onLine = true) => {
  ;(socket as { connected: boolean }).connected = connected
  vi.stubGlobal('navigator', { onLine })
}

describe('playerStatus', () => {
  it('marks the player present', () => {
    const state = statusReducer(undefined, {
      type: PLAYER_STATUS,
      payload: { isPlaying: true },
    })

    expect(state.isPlayerPresent).toBe(true)
    expect(state.isPlaying).toBe(true)
  })
})

describe('playerLeave', () => {
  it('marks the player gone', () => {
    const present = statusReducer(undefined, {
      type: PLAYER_STATUS,
      payload: {},
    })
    expect(present.isPlayerPresent).toBe(true)

    const gone = statusReducer(present, { type: PLAYER_LEAVE })

    expect(gone.isPlayerPresent).toBe(false)
  })
})

describe('switchRoom', () => {
  it('resets room-scoped player status', () => {
    const dirty = statusReducer(undefined, {
      type: PLAYER_STATUS,
      payload: { isPlaying: true, queueId: 7 },
    })
    expect(dirty.isPlayerPresent).toBe(true)

    const reset = statusReducer(dirty, roomSwitched())
    expect(reset).toEqual(statusReducer(undefined, { type: '@@INIT' } as never))
  })
})

describe('playback request thunks', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    ;(socket as { connected: boolean }).connected = false
  })

  it('1. online: requests round-trip through the server', async () => {
    setConnection(true)
    const { store, actions } = makeStore(true)

    await store.dispatch(requestPlay())
    await store.dispatch(requestPause())
    await store.dispatch(requestPlayNext())
    await store.dispatch(requestReplay(7))
    await store.dispatch(requestVolume(0.5))
    await store.dispatch(requestOptions({ pitchSemitones: 2 } as PlaybackOptions))

    const requests = actions.filter(a => a.type.startsWith('server/'))
    expect(requests.map(a => a.type)).toEqual([
      PLAYER_REQ_PLAY,
      PLAYER_REQ_PAUSE,
      PLAYER_REQ_NEXT,
      PLAYER_REQ_REPLAY,
      PLAYER_REQ_VOLUME,
      PLAYER_REQ_OPTIONS,
    ])
    expect(requests.find(a => a.type === PLAYER_REQ_REPLAY)?.payload).toEqual({ queueId: 7 })
    expect(requests.find(a => a.type === PLAYER_REQ_VOLUME)?.payload).toBe(0.5)
  })

  it('2. offline: the player window applies commands locally without emitting', async () => {
    setConnection(false)
    const { store, actions } = makeStore(true)

    await store.dispatch(requestPlay())
    await store.dispatch(requestPause())
    await store.dispatch(requestPlayNext())
    await store.dispatch(requestReplay(7))
    await store.dispatch(requestVolume(0.5))
    await store.dispatch(requestOptions({ pitchSemitones: 2 } as PlaybackOptions))

    expect(actions.map(a => a.type)).toEqual([
      PLAYER_CMD_PLAY,
      PLAYER_CMD_PAUSE,
      PLAYER_CMD_NEXT,
      PLAYER_CMD_REPLAY,
      PLAYER_CMD_VOLUME,
      PLAYER_CMD_OPTIONS,
    ])
    expect(actions.find(a => a.type === PLAYER_CMD_REPLAY)?.payload).toEqual({ queueId: 7 })
    expect(actions.find(a => a.type === PLAYER_CMD_VOLUME)?.payload).toBe(0.5)
    expect(actions.some(a => a.type.startsWith('server/'))).toBe(false)
  })

  it('3. OS-level network loss counts as offline', async () => {
    setConnection(true, false)
    const { store, actions } = makeStore(true)

    await store.dispatch(requestPause())

    expect(actions.map(a => a.type)).toEqual([PLAYER_CMD_PAUSE])
  })

  it('4. offline controllers keep sending requests (no local player)', async () => {
    setConnection(false)
    const { store, actions } = makeStore(false)

    await store.dispatch(requestPlay())

    expect(actions.map(a => a.type)).toEqual([PLAYER_REQ_PLAY])
  })

  it('5. local commands keep the throttle meta of their request', async () => {
    setConnection(false)
    const { store, actions } = makeStore(true)

    await store.dispatch(requestVolume(0.25))
    await store.dispatch(requestOptions({ pitchSemitones: 1 } as PlaybackOptions))

    expect(actions.find(a => a.type === PLAYER_CMD_VOLUME)?.meta).toMatchObject({
      throttle: { wait: 200, leading: false },
    })
    expect(actions.find(a => a.type === PLAYER_CMD_OPTIONS)?.meta).toMatchObject({
      throttle: { wait: 200, leading: true },
    })
  })
})
