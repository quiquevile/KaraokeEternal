import { describe, expect, it, vi } from 'vitest'

vi.mock('./Library.js', () => ({
  default: { starSong: vi.fn(), unstarSong: vi.fn() },
}))

import Library from './Library.js'
import handlers from './socket.js'
import { STAR_SONG, SONG_STARRED, UNSTAR_SONG, SONG_UNSTARRED, _SUCCESS } from '../../shared/actionTypes.js'

describe('song stars socket handlers', () => {
  it('acknowledges and broadcasts a new star', () => {
    vi.mocked(Library.starSong).mockReturnValue(1)
    const emit = vi.fn()
    const ack = vi.fn()
    handlers[STAR_SONG]({ user: { userId: 7 }, server: { emit } }, { payload: { songId: 42 } }, ack)
    expect(ack).toHaveBeenCalledWith({ type: STAR_SONG + _SUCCESS })
    expect(emit).toHaveBeenCalledWith('action', { type: SONG_STARRED, payload: { userId: 7, songId: 42 } })
  })

  it('acknowledges an unchanged star without broadcasting', () => {
    vi.mocked(Library.starSong).mockReturnValue(0)
    const emit = vi.fn()
    const ack = vi.fn()
    handlers[STAR_SONG]({ user: { userId: 7 }, server: { emit } }, { payload: { songId: 42 } }, ack)
    expect(ack).toHaveBeenCalledWith({ type: STAR_SONG + _SUCCESS })
    expect(emit).not.toHaveBeenCalled()
  })

  it('acknowledges and broadcasts a removed star', () => {
    vi.mocked(Library.unstarSong).mockReturnValue(1)
    const emit = vi.fn()
    const ack = vi.fn()
    handlers[UNSTAR_SONG]({ user: { userId: 7 }, server: { emit } }, { payload: { songId: 42 } }, ack)
    expect(ack).toHaveBeenCalledWith({ type: UNSTAR_SONG + _SUCCESS })
    expect(emit).toHaveBeenCalledWith('action', { type: SONG_UNSTARRED, payload: { userId: 7, songId: 42 } })
  })
})
