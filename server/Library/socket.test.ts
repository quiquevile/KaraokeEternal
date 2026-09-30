import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('./Library.js', () => ({
  default: {
    starSong: vi.fn(),
    unstarSong: vi.fn(),
  },
}))

import Library from './Library.js'
import handlers from './socket.js'
import { STAR_SONG, UNSTAR_SONG, SONG_STARRED, SONG_UNSTARRED, _SUCCESS } from '../../shared/actionTypes.js'

const makeSock = () => {
  const emit = vi.fn()

  return {
    sock: {
      user: { userId: 7, roomId: 3 },
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
