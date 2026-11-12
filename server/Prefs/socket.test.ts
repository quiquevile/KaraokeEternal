import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('./Prefs.js', () => ({
  default: {
    set: vi.fn(),
    setPathPriority: vi.fn(),
    get: vi.fn(() => ({})),
    getSanitizedProviders: vi.fn(() => ({ result: [], entities: {} })),
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

  it('pushes full prefs to admins and display prefs to everyone else', () => {
    const ack = vi.fn()
    const sock = makeSock({ userId: 1, isAdmin: true }, new Map([
      ['s0', { id: 's0', user: { userId: 1, isAdmin: true } }],
      ['s1', { id: 's1', user: { userId: 2, isAdmin: false } }],
    ]))

    handlers[PREFS_SET](sock, { payload: { key: 'a', data: 'b' } }, ack)

    expect(Prefs.set).toHaveBeenCalledWith('a', 'b')

    // one room emit per group: full prefs for admins, the shared subset
    // (roles, display timings, sanitized providers) for everyone else
    expect(sock.server.to).toHaveBeenCalledTimes(2)
    expect(sock.server.to).toHaveBeenNthCalledWith(1, ['s0'])
    expect(sock.server.to).toHaveBeenNthCalledWith(2, ['s1'])

    const [adminRoom, userRoom] = sock.server.to.mock.results.map(result => result.value)
    expect(adminRoom.emit).toHaveBeenCalledWith('action', expect.objectContaining({ payload: {} }))
    expect(userRoom.emit).toHaveBeenCalledWith('action', expect.objectContaining({
      payload: { roles: undefined, playerDisplay: undefined, providers: { result: [], entities: {} } },
    }))
    expect(sock.server.emit).not.toHaveBeenCalled()
  })
})
