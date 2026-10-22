import { describe, it, expect, vi } from 'vitest'
import { configureStore } from '@reduxjs/toolkit'
import socket from 'lib/socket'
import reducer, {
  createRoom,
  fetchOwnRoom,
  fetchRooms,
  receiveRooms,
  removeRoom,
  roomDisplayUpdateOf,
  roomPrefsPush,
  updateCurrentRoomOptions,
  updateRoom,
} from './rooms'
import { SOCKET_AUTH_ERROR } from 'shared/actionTypes'
import type { IRoomPrefs } from 'shared/types'

const qrPrefs = (overrides: object = {}): IRoomPrefs => ({
  qr: { isEnabled: false, opacity: 0.625, size: 0.5, ...overrides },
})

const makeStore = () => configureStore({
  reducer: {
    rooms: reducer,
    // the thunks read the own room id from the user slice
    user: (state = { roomId: 1 }) => state,
  },
  preloadedState: {
    rooms: {
      result: [1],
      entities: {
        1: {
          roomId: 1,
          name: 'Room 1',
          status: 'open',
          dateCreated: 0,
          hasPassword: false,
          numUsers: 0,
          prefs: qrPrefs(),
          qrPassword: null,
        },
      },
      currentStatus: null,
      filterStatus: 'open',
      isEditorOpen: false,
      error: null,
    },
  },
})

describe('rooms errors', () => {
  it('records failures and keeps the last known list', async () => {
    const store = makeStore()

    store.dispatch(fetchRooms.rejected(new Error('boom'), 'req1'))
    expect(store.getState().rooms.error).toBe('boom')
    expect(store.getState().rooms.result).toEqual([1])

    store.dispatch(updateRoom.rejected(new Error('nope'), 'req2', { roomId: 1, data: {} }))
    expect(store.getState().rooms.error).toBe('nope')

    store.dispatch(createRoom.rejected(new Error('denied'), 'req3', {}))
    expect(store.getState().rooms.error).toBe('denied')

    store.dispatch(removeRoom.rejected(new Error('gone'), 'req4', 1))
    expect(store.getState().rooms.error).toBe('gone')

    store.dispatch(updateCurrentRoomOptions.rejected(new Error('stale'), 'req5', { prefs: {} }))
    expect(store.getState().rooms.error).toBe('stale')
  })
})

describe('updateCurrentRoomOptions', () => {
  it('merges prefs, key flag and reversible key', async () => {
    const store = makeStore()
    const prefs = qrPrefs({ isEnabled: true, includePassword: true })

    store.dispatch(updateCurrentRoomOptions.fulfilled(
      { room: { roomId: 1, prefs, hasPassword: true, qrPassword: 'c2VjcmV0' } },
      'req1',
      { prefs: { qr: { isEnabled: true, opacity: 0.625, size: 0.5 } } },
    ))

    const entity = store.getState().rooms.entities[1]
    expect(entity.prefs).toEqual(prefs)
    expect(entity.hasPassword).toBe(true)
    expect(entity.qrPassword).toBe('c2VjcmV0')
  })

  it('offline: applies display toggles locally without a server round-trip', async () => {
    ;(socket as { connected: boolean }).connected = false
    vi.stubGlobal('navigator', { onLine: true })
    const store = makeStore()

    await store.dispatch(updateCurrentRoomOptions({
      prefs: { progress: { isEnabled: true, showTime: true, showTitle: true, showSinger: true } },
    }))

    const entity = store.getState().rooms.entities[1]
    expect(entity.prefs.progress).toEqual({ isEnabled: true, showTime: true, showTitle: true, showSinger: true })
    // sibling prefs survive the partial update, and no error is recorded
    expect(entity.prefs.qr).toEqual(qrPrefs().qr)
    expect(store.getState().rooms.error).toBeNull()

    vi.unstubAllGlobals()
    ;(socket as { connected: boolean }).connected = true
  })
})

describe('fetchOwnRoom', () => {
  it('seeds a closed own room missing from the filtered list', async () => {
    const store = configureStore({ reducer: { rooms: reducer } })
    const prefs = qrPrefs({ isEnabled: true })

    store.dispatch(fetchOwnRoom.fulfilled(
      {
        room: {
          roomId: 1, name: 'Room 1', status: 'closed', dateCreated: 0, numUsers: 0,
          prefs, hasPassword: true, qrPassword: 'c2VjcmV0',
        },
      },
      'req1',
      undefined,
    ))

    const entity = store.getState().rooms.entities[1]
    expect(entity.status).toBe('closed')
    expect(entity.prefs).toEqual(prefs)
    expect(entity.qrPassword).toBe('c2VjcmV0')
    expect(store.getState().rooms.result).toEqual([1])
  })

  it('records failures', async () => {
    const store = makeStore()

    store.dispatch(fetchOwnRoom.rejected(new Error('gone'), 'req1', undefined))
    expect(store.getState().rooms.error).toBe('gone')
  })
})

describe('roomDisplayUpdateOf', () => {
  it('extracts only the display keys, dropping stale siblings', () => {
    expect(roomDisplayUpdateOf({
      qr: { isEnabled: true, opacity: 0.5, size: 0.5 },
      eq: { eqEnabled: true, eqGains: [0], eqPreset: 'x' },
    })).toEqual({ qr: { isEnabled: true, opacity: 0.5, size: 0.5 } })
    expect(roomDisplayUpdateOf({
      progress: { isEnabled: false },
      eq: { eqEnabled: true, eqGains: [0], eqPreset: 'x' },
    })).toEqual({ progress: { isEnabled: false } })
    expect(roomDisplayUpdateOf({ eq: { eqEnabled: true, eqGains: [0], eqPreset: 'x' } })).toBeNull()
    expect(roomDisplayUpdateOf({})).toBeNull()
  })
})

describe('roomPrefsPush', () => {
  it('merges key metadata when present', () => {
    const store = makeStore()

    store.dispatch(roomPrefsPush({
      roomId: 1,
      prefs: qrPrefs({ isEnabled: true }),
      hasPassword: true,
      qrPassword: 'c2VjcmV0',
    }))

    const entity = store.getState().rooms.entities[1]
    expect(entity.prefs.qr.isEnabled).toBe(true)
    expect(entity.hasPassword).toBe(true)
    expect(entity.qrPassword).toBe('c2VjcmV0')
  })

  it('keeps the stored key when the push carries prefs only', () => {
    const store = makeStore()

    store.dispatch(roomPrefsPush({ roomId: 1, prefs: qrPrefs({ isEnabled: true }) }))

    const entity = store.getState().rooms.entities[1]
    expect(entity.prefs.qr.isEnabled).toBe(true)
    expect(entity.hasPassword).toBe(false)
    expect(entity.qrPassword).toBeNull()
  })

  it('applies room open/close from admin updates, ignores preview pushes', () => {
    const store = makeStore()

    store.dispatch(roomPrefsPush({ roomId: 1, prefs: qrPrefs(), status: 'closed' }))
    expect(store.getState().rooms.entities[1].status).toBe('closed')

    store.dispatch(roomPrefsPush({ roomId: 1, prefs: qrPrefs() }))
    expect(store.getState().rooms.entities[1].status).toBe('closed')

    store.dispatch(roomPrefsPush({ roomId: 1, prefs: qrPrefs(), status: 'open' }))
    expect(store.getState().rooms.entities[1].status).toBe('open')
  })
})

describe('socket auth error', () => {
  it('resets rooms so stale lists cannot leak closed rooms into login', () => {
    const store = makeStore()

    // stale admin-fetched list with a closed room
    store.dispatch(receiveRooms({
      result: [1, 2],
      entities: {
        1: { roomId: 1, name: 'Open', status: 'open' },
        2: { roomId: 2, name: 'Closed', status: 'closed' },
      },
    }))
    expect(store.getState().rooms.result).toEqual([1, 2])

    store.dispatch({ type: SOCKET_AUTH_ERROR })

    expect(store.getState().rooms.result).toEqual([])
    expect(store.getState().rooms.entities).toEqual({})
    expect(store.getState().rooms.filterStatus).toBe('open')
  })
})
