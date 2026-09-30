import { describe, it, expect } from 'vitest'
import { configureStore } from '@reduxjs/toolkit'
import reducer, {
  createRoom,
  fetchOwnRoom,
  fetchRooms,
  removeRoom,
  roomPrefsPush,
  updateCurrentRoomOptions,
  updateRoom,
} from './rooms'
import type { IRoomPrefs } from 'shared/types'

const qrPrefs = (overrides: object = {}): IRoomPrefs => ({
  qr: { isEnabled: false, opacity: 0.625, size: 0.5, ...overrides },
})

const makeStore = () => configureStore({
  reducer: { rooms: reducer },
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
