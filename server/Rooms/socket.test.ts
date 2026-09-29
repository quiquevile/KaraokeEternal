import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('./Rooms.js', () => ({
  default: {
    prefix: (roomId: number | string = '') => `ROOM_ID_${roomId}`,
  },
}))

import handlers from './socket.js'
import { ROOM_PREFS_PUSH, ROOM_PREFS_PUSH_REQUEST, _ERROR } from '../../shared/actionTypes.js'

const makeSock = (user: object) => ({
  user,
  id: 'sock1',
  server: {
    to: vi.fn(() => ({ emit: vi.fn() })),
    emit: vi.fn(),
  },
})

describe('Rooms socket prefs push', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('broadcasts admin pushes to the whole room', async () => {
    const ack = vi.fn()
    const sock = makeSock({ userId: 1, isAdmin: true })
    const payload = { roomId: 3, prefs: { qr: { isEnabled: true } } }

    await handlers[ROOM_PREFS_PUSH_REQUEST](sock, { payload }, ack)

    expect(ack).not.toHaveBeenCalled()
    expect(sock.server.to).toHaveBeenCalledWith('ROOM_ID_3')
    const emit = vi.mocked(sock.server.to).mock.results[0].value.emit
    expect(emit).toHaveBeenCalledWith('action', {
      type: ROOM_PREFS_PUSH,
      payload,
    })
  })

  it('rejects non-admin pushes without broadcasting', async () => {
    const ack = vi.fn()
    const sock = makeSock({ userId: 5, isAdmin: false })

    await handlers[ROOM_PREFS_PUSH_REQUEST](sock, { payload: { roomId: 3, prefs: {} } }, ack)

    expect(ack).toHaveBeenCalledWith({
      type: ROOM_PREFS_PUSH_REQUEST + _ERROR,
      error: 'Unauthorized',
    })
    expect(sock.server.to).not.toHaveBeenCalled()
  })
})
