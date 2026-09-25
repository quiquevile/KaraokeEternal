import { describe, it, expect, vi } from 'vitest'

import handlers from './socket.js'
import {
  PLAYER_REQ_NEXT,
  PLAYER_REQ_OPTIONS,
  PLAYER_REQ_PAUSE,
  PLAYER_REQ_PLAY,
  PLAYER_REQ_REPLAY,
  PLAYER_REQ_VOLUME,
  PLAYER_CMD_NEXT,
  PLAYER_CMD_OPTIONS,
  PLAYER_CMD_PAUSE,
  PLAYER_CMD_PLAY,
  PLAYER_CMD_REPLAY,
  PLAYER_CMD_VOLUME,
} from '../../shared/actionTypes.js'

const makeSock = (user: object) => {
  const emit = vi.fn()

  return {
    sock: {
      user: { userId: 1, roomId: 5, ...user },
      server: { to: vi.fn(() => ({ emit })) },
    },
    emit,
  }
}

const cases = [
  { req: PLAYER_REQ_PLAY, cmd: PLAYER_CMD_PLAY, payload: undefined, perm: 'playerControls' },
  { req: PLAYER_REQ_PAUSE, cmd: PLAYER_CMD_PAUSE, payload: undefined, perm: 'playerControls' },
  { req: PLAYER_REQ_NEXT, cmd: PLAYER_CMD_NEXT, payload: undefined, perm: 'playerControls' },
  { req: PLAYER_REQ_OPTIONS, cmd: PLAYER_CMD_OPTIONS, payload: { volume: 80 }, perm: 'playerControls' },
  { req: PLAYER_REQ_VOLUME, cmd: PLAYER_CMD_VOLUME, payload: 80, perm: 'playerControls' },
  { req: PLAYER_REQ_REPLAY, cmd: PLAYER_CMD_REPLAY, payload: { queueId: 42 }, perm: 'queueReplay' },
] as const

describe.each(cases)('Player $req', ({ req, cmd, payload, perm }) => {
  const call = (sock: unknown) => (
    handlers[req] as (sock: unknown, msg: unknown, ack: unknown) => unknown
  )(sock, { payload }, vi.fn())

  it('emits the command for admins', () => {
    const { sock, emit } = makeSock({ isAdmin: true })

    call(sock)

    expect(sock.server.to).toHaveBeenCalledWith('ROOM_ID_5')
    expect(emit).toHaveBeenCalledWith('action', { type: cmd, ...(payload === undefined ? {} : { payload }) })
  })

  it('emits the command with the matching permission', () => {
    const { sock, emit } = makeSock({ isAdmin: false, permissions: { [perm]: true } })

    call(sock)

    expect(emit).toHaveBeenCalledTimes(1)
  })

  it('stays silent without the permission', () => {
    const { sock, emit } = makeSock({ isAdmin: false, permissions: {} })

    call(sock)

    expect(emit).not.toHaveBeenCalled()
  })
})

describe('Player PLAY with mere player access', () => {
  const call = (
    req: typeof PLAYER_REQ_PLAY | typeof PLAYER_REQ_PAUSE,
    sock: unknown,
  ) => (
    handlers[req] as (sock: unknown, msg: unknown, ack: unknown) => unknown
  )(sock, { payload: undefined }, vi.fn())

  it('emits play for projection-only users', () => {
    const { sock, emit } = makeSock({ isAdmin: false, permissions: { playerAccess: true } })

    call(PLAYER_REQ_PLAY, sock)

    expect(emit).toHaveBeenCalledWith('action', { type: PLAYER_CMD_PLAY })
  })

  it('keeps pause restricted to player controls', () => {
    const { sock, emit } = makeSock({ isAdmin: false, permissions: { playerAccess: true } })

    call(PLAYER_REQ_PAUSE, sock)

    expect(emit).not.toHaveBeenCalled()
  })
})
