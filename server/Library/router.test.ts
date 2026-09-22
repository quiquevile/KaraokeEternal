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

vi.mock('../lib/pushQueuesAndLibrary.js', () => ({
  default: vi.fn(),
}))

vi.mock('../Youtube/metadata.js', () => ({
  deriveNorms: vi.fn((artist: string, title: string) => ({
    artistNorm: artist,
    titleNorm: title,
  })),
}))

import { handleUpdateSong } from './router.js'
import Library from './Library.js'
import pushQueuesAndLibrary from '../lib/pushQueuesAndLibrary.js'
import { ConflictError, ValidationError } from '../lib/Errors.js'

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

  it('updates the song and pushes full library + queues (admin)', async () => {
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
    expect(ctx.body).toEqual({ 1: { songId: 1, title: 'New Title' } })
    expect(pushQueuesAndLibrary).toHaveBeenCalledWith(ctx.io)
    expect(emitted).toEqual([])
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
