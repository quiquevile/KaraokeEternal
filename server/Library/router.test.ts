import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('./Library.js', () => ({
  default: {
    updateSong: vi.fn(),
    getSong: vi.fn((songId: number) => ({ [songId]: { songId, title: 'New Title' } })),
  },
}))

vi.mock('../Media/Media.js', () => ({
  default: {
    search: vi.fn(() => ({ result: [1], entities: {} })),
  },
}))

vi.mock('../Queue/Queue.js', () => ({
  default: {
    get: vi.fn(() => ({ result: [], entities: {} })),
  },
}))

vi.mock('../Rooms/Rooms.js', () => ({
  default: {
    getActive: vi.fn(() => [{ room: 'ROOM_ID_1', roomId: 1 }]),
  },
}))

vi.mock('../Youtube/metadata.js', () => ({
  deriveNorms: vi.fn((artist: string, title: string) => ({
    artistNorm: artist,
    titleNorm: title,
  })),
}))

import { handleUpdateSong } from './router.js'
import Library from './Library.js'
import Queue from '../Queue/Queue.js'
import Rooms from '../Rooms/Rooms.js'
import { ConflictError, ValidationError } from '../lib/Errors.js'
import { LIBRARY_PUSH_SONG, QUEUE_PUSH } from '../../shared/actionTypes.js'

const makeCtx = (user: object, params: object = { songId: '1' }, body: object = {}) => {
  const emitted: { event: string, channel?: string, data: unknown }[] = []
  return {
    ctx: {
      user,
      params,
      request: { body },
      status: 200,
      body: undefined,
      io: {
        emit: vi.fn((event: string, data: unknown) => { emitted.push({ event, data }) }),
        to: vi.fn((channel: string) => ({
          emit: vi.fn((event: string, data: unknown) => { emitted.push({ event, channel, data }) }),
        })),
      },
      throw: (status: number, message?: string) => {
        const err = new Error(message || String(status))
        Object.assign(err, { status })
        throw err
      },
    },
    emitted,
  }
}

describe('handleUpdateSong', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('updates the song and broadcasts library + queue pushes (admin)', async () => {
    const { ctx, emitted } = makeCtx(
      { isAdmin: true },
      { songId: '1' },
      { artist: 'ABBA', title: 'New Title' },
    )

    await handleUpdateSong(ctx)

    expect(Library.updateSong).toHaveBeenCalledWith(1, {
      artist: 'ABBA',
      title: 'New Title',
      artistNorm: 'ABBA',
      titleNorm: 'New Title',
    })
    expect(ctx.status).toBe(200)
    expect(emitted).toContainEqual({
      event: 'action',
      data: { type: LIBRARY_PUSH_SONG, payload: { 1: { songId: 1, title: 'New Title' } } },
    })
    expect(emitted).toContainEqual({
      event: 'action',
      channel: 'ROOM_ID_1',
      data: { type: QUEUE_PUSH, payload: { result: [], entities: {} } },
    })
    expect(Queue.get).toHaveBeenCalledWith(1)
    expect(Rooms.getActive).toHaveBeenCalledWith(ctx.io)
  })

  it('rejects non-admins with 401 without touching the library', async () => {
    const { ctx } = makeCtx({ isAdmin: false }, { songId: '1' }, { artist: 'A', title: 'T' })

    await expect(handleUpdateSong(ctx)).rejects.toMatchObject({ status: 401 })
    expect(Library.updateSong).not.toHaveBeenCalled()
  })

  it('rejects an invalid songId with 422', async () => {
    const { ctx } = makeCtx({ isAdmin: true }, { songId: 'abc' }, { artist: 'A', title: 'T' })

    await expect(handleUpdateSong(ctx)).rejects.toMatchObject({ status: 422 })
    expect(Library.updateSong).not.toHaveBeenCalled()
  })

  it('maps ValidationError to 422', async () => {
    vi.mocked(Library.updateSong).mockImplementationOnce(() => {
      throw new ValidationError('Artist and title are required')
    })
    const { ctx } = makeCtx({ isAdmin: true }, { songId: '1' }, { artist: '', title: 'T' })

    await expect(handleUpdateSong(ctx)).rejects.toMatchObject({ status: 422 })
  })

  it('maps ConflictError to 409', async () => {
    vi.mocked(Library.updateSong).mockImplementationOnce(() => {
      throw new ConflictError('Another song already has that artist and title')
    })
    const { ctx } = makeCtx({ isAdmin: true }, { songId: '1' }, { artist: 'A', title: 'T' })

    await expect(handleUpdateSong(ctx)).rejects.toMatchObject({ status: 409 })
  })
})
