import { describe, it, expect, vi, beforeEach } from 'vitest'

const { getMock, setMock, setRoomOptionsMock } = vi.hoisted(() => ({
  getMock: vi.fn(),
  setMock: vi.fn(),
  setRoomOptionsMock: vi.fn(),
}))

vi.mock('./Rooms.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./Rooms.js')>()
  return {
    ...actual,
    default: {
      get: getMock,
      set: setMock,
      setRoomOptions: setRoomOptionsMock,
      prefix: (roomId: number | string = '') => `ROOM_ID_${roomId}`,
    },
  }
})

import { handleCurrentRoomStatus, handleCurrentRoomUpdate, handleListRooms, handleUpdateRoom } from './router.js'
import type { RouterContext } from './router.js'

function makeIo () {
  return {
    to: vi.fn(() => ({ emit: vi.fn() })),
    sockets: { adapter: { rooms: { get: vi.fn(() => ({ size: 3 })) } } },
  }
}

function makeCtx (overrides: Record<string, unknown> = {}): RouterContext {
  return {
    user: { isAdmin: false, userId: 5, username: 'tester', roomId: 1 },
    params: {},
    query: {},
    request: { body: {} },
    body: undefined,
    status: 200,
    throw (status: number, message?: string): never {
      const err = new Error(message ?? String(status)) as Error & { status: number }
      err.status = status
      throw err
    },
    io: makeIo(),
    ...overrides,
  } as RouterContext
}

describe('handleCurrentRoomStatus', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns open status for a non-admin in an open room', () => {
    getMock.mockReturnValue({
      result: [1],
      entities: { 1: { roomId: 1, status: 'open' } },
    })

    const ctx = makeCtx()
    handleCurrentRoomStatus(ctx)

    expect(getMock).toHaveBeenCalledWith(1, { status: ['open', 'closed'] })
    expect(ctx.body).toEqual({ roomId: 1, status: 'open' })
  })

  it('returns closed status for a non-admin in a closed room', () => {
    getMock.mockReturnValue({
      result: [1],
      entities: { 1: { roomId: 1, status: 'closed' } },
    })

    const ctx = makeCtx()
    handleCurrentRoomStatus(ctx)

    expect(ctx.body).toEqual({ roomId: 1, status: 'closed' })
  })

  it('rejects anonymous users with 401', () => {
    const ctx = makeCtx({ user: { isAdmin: false, userId: null, username: null, roomId: null } })

    expect(() => handleCurrentRoomStatus(ctx)).toThrowError(expect.objectContaining({ status: 401 }))
    expect(getMock).not.toHaveBeenCalled()
  })

  it('returns 404 when the user is not in a room', () => {
    const ctx = makeCtx({ user: { isAdmin: false, userId: 5, username: 'tester', roomId: null } })

    expect(() => handleCurrentRoomStatus(ctx)).toThrowError(expect.objectContaining({ status: 404 }))
    expect(getMock).not.toHaveBeenCalled()
  })

  it('returns 404 when the room no longer exists', () => {
    getMock.mockReturnValue({ result: [], entities: {} })

    const ctx = makeCtx()

    expect(() => handleCurrentRoomStatus(ctx)).toThrowError(expect.objectContaining({ status: 404 }))
  })
})

describe('handleCurrentRoomUpdate', () => {
  const merged = { qr: { isEnabled: true }, roles: { 3: { allowNew: false } } }

  beforeEach(() => {
    vi.clearAllMocks()
    setRoomOptionsMock.mockReturnValue(merged)
    getMock.mockReturnValue({
      result: [1],
      entities: { 1: { roomId: 1, prefs: merged, hasPassword: true, qrPassword: 'c2VjcmV0' } },
    })
  })

  it('lets playback controllers update their own room', async () => {
    const ctx = makeCtx({
      user: { isAdmin: false, userId: 5, username: 'tester', roomId: 1, permissions: { playerControls: true } },
      request: { body: { prefs: { qr: { isEnabled: true } } } },
    })

    await handleCurrentRoomUpdate(ctx)

    expect(setRoomOptionsMock).toHaveBeenCalledWith(1, { prefs: { qr: { isEnabled: true } } })
    expect(ctx.body).toEqual({ room: { roomId: 1, prefs: merged, hasPassword: true, qrPassword: 'c2VjcmV0' } })
    expect(ctx.io.to).toHaveBeenCalledWith('ROOM_ID_1')
  })

  it('returns a null key when the room has no reversible password', async () => {
    getMock.mockReturnValue({
      result: [1],
      entities: { 1: { roomId: 1, prefs: merged, hasPassword: false } },
    })
    const ctx = makeCtx({
      user: { isAdmin: false, userId: 5, username: 'tester', roomId: 1, permissions: { playerControls: true } },
      request: { body: { prefs: { qr: { isEnabled: true } } } },
    })

    await handleCurrentRoomUpdate(ctx)

    expect(ctx.body).toEqual({ room: { roomId: 1, prefs: merged, hasPassword: false, qrPassword: null } })
  })

  it('lets admins update their own room', async () => {
    const ctx = makeCtx({
      user: { isAdmin: true, userId: 1, username: 'admin', roomId: 1 },
      request: { body: { prefs: { qr: { isEnabled: true } } } },
    })

    await handleCurrentRoomUpdate(ctx)

    expect(setRoomOptionsMock).toHaveBeenCalled()
  })

  it('rejects users without playback controls with 401', async () => {
    const ctx = makeCtx({
      user: { isAdmin: false, userId: 5, username: 'tester', roomId: 1, permissions: {} },
      request: { body: { prefs: { qr: { isEnabled: true } } } },
    })

    await expect(handleCurrentRoomUpdate(ctx)).rejects.toMatchObject({ status: 401 })
    expect(setRoomOptionsMock).not.toHaveBeenCalled()
  })

  it('rejects anonymous users with 401 and roomless users with 404', async () => {
    const anon = makeCtx({
      user: { isAdmin: false, userId: null, roomId: null },
      request: { body: { prefs: {} } },
    })
    await expect(handleCurrentRoomUpdate(anon)).rejects.toMatchObject({ status: 401 })

    const roomless = makeCtx({
      user: { isAdmin: true, userId: 1, roomId: null },
      request: { body: { prefs: {} } },
    })
    await expect(handleCurrentRoomUpdate(roomless)).rejects.toMatchObject({ status: 404 })
    expect(setRoomOptionsMock).not.toHaveBeenCalled()
  })

  it('rejects missing prefs with 422', async () => {
    const ctx = makeCtx({
      user: { isAdmin: true, userId: 1, roomId: 1 },
      request: { body: {} },
    })

    await expect(handleCurrentRoomUpdate(ctx)).rejects.toMatchObject({ status: 422 })
    expect(setRoomOptionsMock).not.toHaveBeenCalled()
  })
})

describe('handleListRooms', () => {
  const fullPrefs = {
    qr: { isEnabled: true, password: 'secret' },
    eq: { eqEnabled: true, eqGains: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0], eqPreset: 'Flat' },
    roles: { 3: { allowNew: false } },
    user: { isGuestAllowed: true },
  }

  beforeEach(() => {
    vi.clearAllMocks()
    getMock.mockReturnValue({
      result: [1, 2],
      entities: {
        1: { roomId: 1, prefs: structuredClone(fullPrefs) },
        2: { roomId: 2, prefs: structuredClone(fullPrefs) },
      },
    })
  })

  it('exposes qr prefs only for the non-admin own room', () => {
    const ctx = makeCtx({
      user: { isAdmin: false, userId: 5, username: 'tester', roomId: 1 },
    })

    handleListRooms(ctx)

    const body = ctx.body as { entities: Record<number, { prefs: object }> }
    expect(body.entities[1].prefs).toEqual({ roles: fullPrefs.roles, qr: fullPrefs.qr, eq: fullPrefs.eq })
    expect(body.entities[2].prefs).toEqual({ roles: fullPrefs.roles })
  })

  it('exposes the reversible key only for the non-admin own room', () => {
    getMock.mockReturnValue({
      result: [1, 2],
      entities: {
        1: { roomId: 1, prefs: {}, qrPassword: 'c2VjcmV0' },
        2: { roomId: 2, prefs: {}, qrPassword: 'c2VjcmV0' },
      },
    })
    const ctx = makeCtx({
      user: { isAdmin: false, userId: 5, username: 'tester', roomId: 1 },
    })

    handleListRooms(ctx)

    const body = ctx.body as { entities: Record<number, { qrPassword?: string | null }> }
    expect(body.entities[1].qrPassword).toBe('c2VjcmV0')
    expect(body.entities[2].qrPassword).toBeUndefined()
  })

  it('leaves admin entities untouched with user counts', () => {
    const ctx = makeCtx({
      user: { isAdmin: true, userId: 1, username: 'admin', roomId: 1 },
    })

    handleListRooms(ctx)

    const body = ctx.body as { entities: Record<number, { prefs: object, numUsers: number }> }
    expect(body.entities[1].prefs).toEqual(fullPrefs)
    expect(body.entities[1].numUsers).toBe(3)
  })
})

describe('handleUpdateRoom', () => {
  const prefs = { qr: { isEnabled: true } }

  beforeEach(() => {
    vi.clearAllMocks()
    setRoomOptionsMock.mockReturnValue(prefs)
    getMock.mockImplementation((roomId: number | null | undefined) => (
      roomId == null
        ? { result: [3], entities: { 3: { roomId: 3 } } }
        : { result: [3], entities: { 3: { roomId: 3, prefs, hasPassword: true, qrPassword: 'c2VjcmV0' } } }
    ))
  })

  it('pushes the updated prefs to the whole room with the prefs-push shape', async () => {
    const ctx = makeCtx({
      user: { isAdmin: true, userId: 1, username: 'admin', roomId: 1 },
      params: { roomId: '3' },
      request: { body: { name: 'Room 3', status: 'open' } },
    })

    await handleUpdateRoom(ctx)

    const emit = vi.mocked(ctx.io.to).mock.results[0].value.emit
    expect(ctx.io.to).toHaveBeenCalledWith('ROOM_ID_3')
    expect(emit).toHaveBeenCalledWith('action', {
      type: 'rooms/ROOM_PREFS_PUSH',
      payload: { roomId: 3, prefs, hasPassword: true, qrPassword: 'c2VjcmV0' },
    })
  })

  it('rejects non-admins with 401', async () => {
    const ctx = makeCtx({
      user: { isAdmin: false, userId: 5, username: 'tester', roomId: 1 },
      params: { roomId: '3' },
      request: { body: {} },
    })

    await expect(handleUpdateRoom(ctx)).rejects.toMatchObject({ status: 401 })
  })
})
