import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('./Prefs.js', () => ({
  default: {
    set: vi.fn(),
    setPathPriority: vi.fn(),
    get: vi.fn(() => ({})),
  },
}))

vi.mock('../Library/Library.js', () => ({
  default: {
    cache: {},
    get: vi.fn(() => ({})),
  },
}))

import handlers from './socket.js'
import Prefs from './Prefs.js'
import { PREFS_SET, PREFS_PATH_SET_PRIORITY } from '../../shared/actionTypes.js'

const makeSock = (user: object, sockets: Map<string, object> = new Map()) => ({
  user,
  id: 'sock1',
  server: {
    sockets: { sockets },
    to: vi.fn(() => ({ emit: vi.fn() })),
    emit: vi.fn(),
  },
})

describe('Prefs socket auth', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('rejects PREFS_SET for non-admins without applying', () => {
    const ack = vi.fn()
    const sock = makeSock({ userId: 1, isAdmin: false })

    handlers[PREFS_SET](sock, { payload: { key: 'a', data: 'b' } }, ack)

    expect(ack).toHaveBeenCalledWith({ type: `${PREFS_SET}_ERROR`, error: 'Unauthorized' })
    expect(Prefs.set).not.toHaveBeenCalled()
  })

  it('rejects PREFS_PATH_SET_PRIORITY for non-admins without applying', () => {
    const ack = vi.fn()
    const sock = makeSock({ userId: 1, isAdmin: false })

    handlers[PREFS_PATH_SET_PRIORITY](sock, { payload: {} }, ack)

    expect(ack).toHaveBeenCalledWith({ type: `${PREFS_PATH_SET_PRIORITY}_ERROR`, error: 'Unauthorized' })
    expect(Prefs.setPathPriority).not.toHaveBeenCalled()
  })

  it('pushes prefs only to admin sockets', () => {
    const adminEmit = vi.fn()
    const userEmit = vi.fn()
    const ack = vi.fn()
    const sock = makeSock({ userId: 1, isAdmin: true }, new Map([
      ['s0', { user: { userId: 1, isAdmin: true }, emit: adminEmit }],
      ['s1', { user: { userId: 2, isAdmin: false }, emit: userEmit }],
    ]))

    handlers[PREFS_SET](sock, { payload: { key: 'a', data: 'b' } }, ack)

    expect(Prefs.set).toHaveBeenCalledWith('a', 'b')
    expect(adminEmit).toHaveBeenCalledTimes(1)
    expect(userEmit).not.toHaveBeenCalled()
    expect(sock.server.emit).not.toHaveBeenCalled()
  })
})
