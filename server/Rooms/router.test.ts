import { describe, it, expect, vi, beforeEach } from 'vitest'

const { getMock } = vi.hoisted(() => ({ getMock: vi.fn() }))

vi.mock('./Rooms.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./Rooms.js')>()
  return {
    ...actual,
    default: { get: getMock },
  }
})

import { handleCurrentRoomStatus } from './router.js'
import type { RouterContext } from './router.js'

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
