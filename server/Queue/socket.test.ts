import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('./Queue.js', () => ({
  default: {
    add: vi.fn(),
    move: vi.fn(),
    get: vi.fn(() => []),
    remove: vi.fn(),
    isOwner: vi.fn(),
  },
}))

vi.mock('../Rooms/Rooms.js', () => ({
  default: {
    validate: vi.fn().mockResolvedValue(true),
    prefix: vi.fn((roomId: number) => `room-${roomId}`),
  },
}))

import Queue from './Queue.js'
import handlers from './socket.js'
import { QUEUE_MOVE, QUEUE_REMOVE } from '../../shared/actionTypes.js'

const makeSock = (user: object) => ({
  user,
  server: { to: () => ({ emit: vi.fn() }) },
})

describe('Queue socket permissions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(Queue.isOwner).mockReturnValue(false)
  })

  it('allows a user with queueMove permission to move another user\'s song', async () => {
    const ack = vi.fn()
    const sock = makeSock({ userId: 1, roomId: 5, isAdmin: false, permissions: { queueMove: true } })

    await handlers[QUEUE_MOVE](sock, { payload: { queueId: 42, prevQueueId: 41 } }, ack)

    expect(ack).toHaveBeenCalledWith({ type: QUEUE_MOVE + '_SUCCESS' })
    expect(Queue.move).toHaveBeenCalledWith({ prevQueueId: 41, queueId: 42, roomId: 5 })
  })

  it('rejects a standard user moving another user\'s song', async () => {
    const ack = vi.fn()
    const sock = makeSock({ userId: 1, roomId: 5, isAdmin: false, permissions: {} })

    await handlers[QUEUE_MOVE](sock, { payload: { queueId: 42, prevQueueId: 41 } }, ack)

    expect(ack).toHaveBeenCalledWith({
      type: QUEUE_MOVE + '_ERROR',
      error: 'Cannot move another user\'s song',
    })
    expect(Queue.move).not.toHaveBeenCalled()
  })

  it('allows an admin to move another user\'s song', async () => {
    const ack = vi.fn()
    const sock = makeSock({ userId: 1, roomId: 5, isAdmin: true, permissions: {} })

    await handlers[QUEUE_MOVE](sock, { payload: { queueId: 42, prevQueueId: 41 } }, ack)

    expect(ack).toHaveBeenCalledWith({ type: QUEUE_MOVE + '_SUCCESS' })
    expect(Queue.move).toHaveBeenCalledWith({ prevQueueId: 41, queueId: 42, roomId: 5 })
  })

  it('allows a user with queueDelete permission to remove another user\'s songs', async () => {
    const ack = vi.fn()
    const sock = makeSock({ userId: 1, roomId: 5, isAdmin: false, permissions: { queueDelete: true } })

    handlers[QUEUE_REMOVE](sock, { payload: { queueId: [42, 43] } }, ack)

    expect(ack).toHaveBeenCalledWith({ type: QUEUE_REMOVE + '_SUCCESS' })
    expect(Queue.remove).toHaveBeenCalledTimes(2)
  })

  it('rejects a standard user removing another user\'s songs', async () => {
    const ack = vi.fn()
    const sock = makeSock({ userId: 1, roomId: 5, isAdmin: false, permissions: {} })

    handlers[QUEUE_REMOVE](sock, { payload: { queueId: 42 } }, ack)

    expect(ack).toHaveBeenCalledWith({
      type: QUEUE_REMOVE + '_ERROR',
      error: 'Cannot remove another user\'s song',
    })
    expect(Queue.remove).not.toHaveBeenCalled()
  })

  it('allows an admin to remove another user\'s songs', async () => {
    const ack = vi.fn()
    const sock = makeSock({ userId: 1, roomId: 5, isAdmin: true, permissions: {} })

    handlers[QUEUE_REMOVE](sock, { payload: { queueId: [42, 43] } }, ack)

    expect(ack).toHaveBeenCalledWith({ type: QUEUE_REMOVE + '_SUCCESS' })
    expect(Queue.remove).toHaveBeenCalledTimes(2)
  })
})
