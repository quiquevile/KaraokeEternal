import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('./Library.js', () => ({
  default: {
    starSong: vi.fn(),
    unstarSong: vi.fn(),
    flawSong: vi.fn(),
    unflawSong: vi.fn(),
  },
}))

import Library from './Library.js'
import handlers from './socket.js'
import {
  STAR_SONG, UNSTAR_SONG, SONG_STARRED, SONG_UNSTARRED,
  FLAW_SONG, UNFLAW_SONG, SONG_FLAWED, SONG_UNFLAWED,
  _SUCCESS,
} from '../../shared/actionTypes.js'

const makeSock = (user: Record<string, unknown> = {}) => {
  const emit = vi.fn()

  return {
    sock: {
      user: { userId: 7, roomId: 3, ...user },
      server: { emit },
    },
    emit,
  }
}

describe('Library star socket handlers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('acks and broadcasts starring on change', () => {
    vi.mocked(Library.starSong).mockReturnValue(1)
    const ack = vi.fn()
    const { sock, emit } = makeSock()

    handlers[STAR_SONG](sock, { payload: { songId: 42 } }, ack)

    expect(Library.starSong).toHaveBeenCalledWith(42, 7)
    expect(ack).toHaveBeenCalledWith({ type: STAR_SONG + _SUCCESS })
    expect(emit).toHaveBeenCalledWith('action', {
      type: SONG_STARRED,
      payload: { userId: 7, songId: 42 },
    })
  })

  it('acks without broadcasting a no-op star', () => {
    vi.mocked(Library.starSong).mockReturnValue(0)
    const ack = vi.fn()
    const { sock, emit } = makeSock()

    handlers[STAR_SONG](sock, { payload: { songId: 42 } }, ack)

    expect(ack).toHaveBeenCalledWith({ type: STAR_SONG + _SUCCESS })
    expect(emit).not.toHaveBeenCalled()
  })

  it('acks and broadcasts unstarring on change', () => {
    vi.mocked(Library.unstarSong).mockReturnValue(1)
    const ack = vi.fn()
    const { sock, emit } = makeSock()

    handlers[UNSTAR_SONG](sock, { payload: { songId: 42 } }, ack)

    expect(Library.unstarSong).toHaveBeenCalledWith(42, 7)
    expect(ack).toHaveBeenCalledWith({ type: UNSTAR_SONG + _SUCCESS })
    expect(emit).toHaveBeenCalledWith('action', {
      type: SONG_UNSTARRED,
      payload: { userId: 7, songId: 42 },
    })
  })

  it('acks without broadcasting a no-op unstar', () => {
    vi.mocked(Library.unstarSong).mockReturnValue(0)
    const ack = vi.fn()
    const { sock, emit } = makeSock()

    handlers[UNSTAR_SONG](sock, { payload: { songId: 42 } }, ack)

    expect(ack).toHaveBeenCalledWith({ type: UNSTAR_SONG + _SUCCESS })
    expect(emit).not.toHaveBeenCalled()
  })
})

describe('Library flaw socket handlers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('rejects flawing without the songFlaws permission', () => {
    const ack = vi.fn()
    const { sock, emit } = makeSock()

    handlers[FLAW_SONG](sock, { payload: { songId: 42 } }, ack)

    expect(Library.flawSong).not.toHaveBeenCalled()
    expect(ack).toHaveBeenCalledWith({
      type: FLAW_SONG + '_ERROR',
      error: expect.any(String),
    })
    expect(emit).not.toHaveBeenCalled()
  })

  it('acks and broadcasts flawing for an admin', () => {
    vi.mocked(Library.flawSong).mockReturnValue(1)
    const ack = vi.fn()
    const { sock, emit } = makeSock({ isAdmin: true })

    handlers[FLAW_SONG](sock, { payload: { songId: 42 } }, ack)

    expect(Library.flawSong).toHaveBeenCalledWith(42, 7)
    expect(ack).toHaveBeenCalledWith({ type: FLAW_SONG + _SUCCESS })
    expect(emit).toHaveBeenCalledWith('action', {
      type: SONG_FLAWED,
      payload: { userId: 7, songId: 42 },
    })
  })

  it('acks flawing with the songFlaws permission', () => {
    vi.mocked(Library.flawSong).mockReturnValue(1)
    const ack = vi.fn()
    const { sock } = makeSock({ isAdmin: false, permissions: { songFlaws: true } })

    handlers[FLAW_SONG](sock, { payload: { songId: 42 } }, ack)

    expect(Library.flawSong).toHaveBeenCalledWith(42, 7)
    expect(ack).toHaveBeenCalledWith({ type: FLAW_SONG + _SUCCESS })
  })

  it('acks without broadcasting a no-op flaw', () => {
    vi.mocked(Library.flawSong).mockReturnValue(0)
    const ack = vi.fn()
    const { sock, emit } = makeSock({ isAdmin: true })

    handlers[FLAW_SONG](sock, { payload: { songId: 42 } }, ack)

    expect(ack).toHaveBeenCalledWith({ type: FLAW_SONG + _SUCCESS })
    expect(emit).not.toHaveBeenCalled()
  })

  it('rejects unflawing without the songFlaws permission', () => {
    const ack = vi.fn()
    const { sock, emit } = makeSock()

    handlers[UNFLAW_SONG](sock, { payload: { songId: 42 } }, ack)

    expect(Library.unflawSong).not.toHaveBeenCalled()
    expect(ack).toHaveBeenCalledWith({
      type: UNFLAW_SONG + '_ERROR',
      error: expect.any(String),
    })
    expect(emit).not.toHaveBeenCalled()
  })

  it('acks and broadcasts unflawing on change', () => {
    vi.mocked(Library.unflawSong).mockReturnValue(1)
    const ack = vi.fn()
    const { sock, emit } = makeSock({ isAdmin: true })

    handlers[UNFLAW_SONG](sock, { payload: { songId: 42 } }, ack)

    expect(Library.unflawSong).toHaveBeenCalledWith(42, 7)
    expect(ack).toHaveBeenCalledWith({ type: UNFLAW_SONG + _SUCCESS })
    expect(emit).toHaveBeenCalledWith('action', {
      type: SONG_UNFLAWED,
      payload: { userId: 7, songId: 42 },
    })
  })

  it('acks without broadcasting a no-op unflaw', () => {
    vi.mocked(Library.unflawSong).mockReturnValue(0)
    const ack = vi.fn()
    const { sock, emit } = makeSock({ isAdmin: true })

    handlers[UNFLAW_SONG](sock, { payload: { songId: 42 } }, ack)

    expect(ack).toHaveBeenCalledWith({ type: UNFLAW_SONG + _SUCCESS })
    expect(emit).not.toHaveBeenCalled()
  })
})
