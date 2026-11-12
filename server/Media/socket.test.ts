import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('./Media.js', () => ({
  default: {
    setPitch: vi.fn(),
    setUserPitch: vi.fn(),
    setReplayGain: vi.fn(),
  },
}))

vi.mock('../Rooms/Rooms.js', () => ({
  default: {
    getActive: vi.fn(() => []),
  },
}))

vi.mock('../Queue/Queue.js', () => ({
  default: {
    get: vi.fn(() => ({ entities: {} })),
  },
}))

import handlers from './socket.js'
import Media from './Media.js'
import Rooms from '../Rooms/Rooms.js'
import { MEDIA_PITCH_SET, _ERROR, _SUCCESS } from '../../shared/actionTypes.js'

const makeSock = (user: object) => ({
  user,
  id: 'sock1',
  server: {
    to: vi.fn(() => ({ emit: vi.fn() })),
    emit: vi.fn(),
  },
})

describe('Media socket auth: MEDIA_PITCH_SET', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(Media.setPitch).mockReturnValue(true)
  })

  it('rejects non-admins without the capability', () => {
    const ack = vi.fn()
    const sock = makeSock({ userId: 1, name: 'u', isAdmin: false, permissions: {} })

    handlers[MEDIA_PITCH_SET](sock, { payload: { mediaId: 10, pitch: 2 } }, ack)

    expect(ack).toHaveBeenCalledWith({ type: MEDIA_PITCH_SET + _ERROR, error: 'Unauthorized' })
    expect(Media.setPitch).not.toHaveBeenCalled()
  })

  it('rejects parent-only grants (playerControls without setSongPitch)', () => {
    const ack = vi.fn()
    const sock = makeSock({ userId: 1, name: 'u', isAdmin: false, permissions: { playerControls: true } })

    handlers[MEDIA_PITCH_SET](sock, { payload: { mediaId: 10, pitch: 2 } }, ack)

    expect(ack).toHaveBeenCalledWith({ type: MEDIA_PITCH_SET + _ERROR, error: 'Unauthorized' })
    expect(Media.setPitch).not.toHaveBeenCalled()
  })

  it('allows non-admins with the capability', () => {
    const ack = vi.fn()
    const sock = makeSock({ userId: 1, name: 'u', isAdmin: false, permissions: { setSongPitch: true } })

    handlers[MEDIA_PITCH_SET](sock, { payload: { mediaId: 10, pitch: 2 } }, ack)

    expect(ack).toHaveBeenCalledWith({ type: MEDIA_PITCH_SET + _SUCCESS })
    expect(Media.setPitch).toHaveBeenCalledWith(10, 2)
    expect(Rooms.getActive).toHaveBeenCalledWith(sock.server)
  })

  it('allows admins regardless of permissions', () => {
    const ack = vi.fn()
    const sock = makeSock({ userId: 1, name: 'u', isAdmin: true, permissions: {} })

    handlers[MEDIA_PITCH_SET](sock, { payload: { mediaId: 10, pitch: -3 } }, ack)

    expect(ack).toHaveBeenCalledWith({ type: MEDIA_PITCH_SET + _SUCCESS })
    expect(Media.setPitch).toHaveBeenCalledWith(10, -3)
  })

  it('rejects out-of-range pitch without applying', () => {
    const ack = vi.fn()
    const sock = makeSock({ userId: 1, name: 'u', isAdmin: false, permissions: { setSongPitch: true } })

    handlers[MEDIA_PITCH_SET](sock, { payload: { mediaId: 10, pitch: 99 } }, ack)

    expect(ack).toHaveBeenCalledWith({ type: MEDIA_PITCH_SET + _ERROR, error: 'Invalid pitch' })
    expect(Media.setPitch).not.toHaveBeenCalled()
  })

  it('acknowledges success but skips the broadcast when nothing changed', () => {
    vi.mocked(Media.setPitch).mockReturnValue(false)
    const ack = vi.fn()
    const sock = makeSock({ userId: 1, name: 'u', isAdmin: false, permissions: { setSongPitch: true } })

    handlers[MEDIA_PITCH_SET](sock, { payload: { mediaId: 10, pitch: 2 } }, ack)

    expect(ack).toHaveBeenCalledWith({ type: MEDIA_PITCH_SET + _SUCCESS })
    expect(Rooms.getActive).not.toHaveBeenCalled()
  })
})
