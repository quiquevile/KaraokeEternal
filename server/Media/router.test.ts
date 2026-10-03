import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('fs', () => ({
  default: {
    createReadStream: vi.fn().mockReturnValue({ on: vi.fn() }),
    existsSync: vi.fn(),
    renameSync: vi.fn(),
    statSync: vi.fn(() => { throw new Error('ENOENT') }),
  },
  createReadStream: vi.fn().mockReturnValue({ on: vi.fn() }),
  existsSync: vi.fn(),
  renameSync: vi.fn(),
  statSync: vi.fn(() => { throw new Error('ENOENT') }),
}))

vi.mock('node:fs/promises', () => ({
  default: {
    stat: vi.fn().mockResolvedValue({ size: 1024 }),
    readFile: vi.fn().mockResolvedValue(new Uint8Array([1, 2, 3])),
  },
  stat: vi.fn().mockResolvedValue({ size: 1024 }),
  readFile: vi.fn().mockResolvedValue(new Uint8Array([1, 2, 3])),
}))

vi.mock('unzipit', () => ({
  unzip: vi.fn(),
}))

vi.mock('../lib/getFolders.js', () => ({
  default: vi.fn(),
}))

vi.mock('../Media/Media.js', () => ({
  default: {
    search: vi.fn(),
    setPreferred: vi.fn(),
    update: vi.fn(),
  },
}))

vi.mock('../Prefs/Prefs.js', () => ({
  default: {
    get: vi.fn(),
  },
}))

vi.mock('../Queue/Queue.js', () => ({
  default: {
    get: vi.fn(),
  },
}))

vi.mock('../Library/Library.js', () => ({
  default: {
    deleteMedia: vi.fn(),
    getSong: vi.fn(),
  },
}))

vi.mock('../lib/pushQueuesAndLibrary.js', () => ({
  default: vi.fn(),
  pushQueues: vi.fn(),
}))

vi.mock('../Rooms/Rooms.js', () => ({
  default: {
    getActive: vi.fn(() => []),
  },
}))

import router from './router.js'
import Media from '../Media/Media.js'
import type { MediaRow } from '../Media/Media.js'
import Prefs from '../Prefs/Prefs.js'
import Library from '../Library/Library.js'
import pushQueuesAndLibrary from '../lib/pushQueuesAndLibrary.js'
import { unzip } from 'unzipit'
import { NotFoundError, ValidationError } from '../lib/Errors.js'

const mockSong = {
  result: [123],
  entities: { 123: { pathId: 1, relPath: 'file.mp3' } },
} as unknown as ReturnType<typeof Media.search>
const mockPrefs = {
  paths: { entities: { 1: { path: '/audio' } } },
} as unknown as ReturnType<typeof Prefs.get>

// partial rows are fine for handler tests (only the accessed fields matter)
const mockSearchResult = (row: object) => ({
  result: [123],
  entities: { 123: row as MediaRow },
})

const makeCtx = (user: object) => ({
  method: 'GET',
  path: '/api/media/123',
  query: { type: 'audio' },
  user,
  length: undefined,
  type: undefined,
  status: 200,
  body: undefined,
  request: {},
  host: undefined,
  throw: (status: number, message?: string) => {
    const err = new Error(message || String(status))
    Object.assign(err, { status })
    throw err
  },
})

const dispatch = router.routes() as (ctx: object, next: () => void) => Promise<void>

describe('Media media streaming permissions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(Media.search).mockReturnValue(mockSong)
    vi.mocked(Prefs.get).mockReturnValue(mockPrefs)
  })

  it('streams media for a user with playerAccess', async () => {
    const ctx = makeCtx({ isAdmin: false, permissions: { playerAccess: true } })

    await expect(dispatch(ctx, () => {})).resolves.toBeUndefined()
    expect(ctx.status).toBe(200)
    expect(ctx.type).toBe('audio/mpeg')
  })

  it('streams media for an admin', async () => {
    const ctx = makeCtx({ isAdmin: true, permissions: {} })

    await expect(dispatch(ctx, () => {})).resolves.toBeUndefined()
    expect(ctx.status).toBe(200)
  })

  it('rejects streaming for a standard user', async () => {
    const ctx = makeCtx({ isAdmin: false, permissions: {} })

    await expect(dispatch(ctx, () => {})).rejects.toMatchObject({ status: 401 })
  })

  it('rejects invalid mediaIds with 422', async () => {
    const ctx = {
      ...makeCtx({ isAdmin: true }),
      path: '/api/media/abc',
    }

    await expect(dispatch(ctx, () => {})).rejects.toMatchObject({ status: 422 })
  })

  it('rejects unknown media with 404', async () => {
    vi.mocked(Media.search).mockReturnValue({ result: [], entities: {} })
    const ctx = makeCtx({ isAdmin: true })

    await expect(dispatch(ctx, () => {})).rejects.toMatchObject({ status: 404 })
  })

  it('rejects unknown MIME types with 404', async () => {
    vi.mocked(Media.search).mockReturnValue(mockSearchResult({ pathId: 1, relPath: 'file.unknown' }))
    const ctx = makeCtx({ isAdmin: true })

    await expect(dispatch(ctx, () => {})).rejects.toMatchObject({ status: 404, message: 'unknown media type' })
  })

  it('rejects media whose path was removed with 404', async () => {
    vi.mocked(Prefs.get).mockReturnValue({ paths: { entities: {} } } as unknown as ReturnType<typeof Prefs.get>)
    const ctx = makeCtx({ isAdmin: true })

    await expect(dispatch(ctx, () => {})).rejects.toMatchObject({ status: 404, message: 'media path not found' })
  })

  it('maps missing files to 404 without leaking the path', async () => {
    const fsPromises = (await import('node:fs/promises')).default
    const enoent = Object.assign(new Error('ENOENT: no such file'), { code: 'ENOENT' })
    vi.mocked(fsPromises.stat).mockRejectedValueOnce(enoent)
    const ctx = makeCtx({ isAdmin: true })

    const err = await dispatch(ctx, () => {}).catch(e => e)
    expect(err).toMatchObject({ status: 404, message: 'media file not found' })
    expect(err.message).not.toContain('/audio')
  })

  it('streams the audio entry of a zip archive', async () => {
    vi.mocked(Media.search).mockReturnValue(mockSearchResult({ pathId: 1, relPath: 'archive.zip' }))
    vi.mocked(unzip).mockResolvedValue({
      entries: {
        'track.mp3': { size: 100, arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer },
      },
    } as unknown as Awaited<ReturnType<typeof unzip>>)
    const ctx = makeCtx({ isAdmin: true })

    await expect(dispatch(ctx, () => {})).resolves.toBeUndefined()
    expect(ctx.status).toBe(200)
    expect(ctx.type).toBe('audio/mpeg')
  })

  it('streams the cdg sidecar of a zip archive', async () => {
    vi.mocked(Media.search).mockReturnValue(mockSearchResult({ pathId: 1, relPath: 'archive.zip' }))
    vi.mocked(unzip).mockResolvedValue({
      entries: {
        'track.mp3': { size: 100, arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer },
        'track.cdg': { size: 50, arrayBuffer: async () => new Uint8Array([4, 5]).buffer },
      },
    } as unknown as Awaited<ReturnType<typeof unzip>>)
    const ctx = { ...makeCtx({ isAdmin: true }), query: { type: 'cdg' } }

    await expect(dispatch(ctx, () => {})).resolves.toBeUndefined()
    expect(ctx.status).toBe(200)
  })

  it('rejects zips without a valid audio entry with 404', async () => {
    vi.mocked(Media.search).mockReturnValue(mockSearchResult({ pathId: 1, relPath: 'archive.zip' }))
    vi.mocked(unzip).mockResolvedValue({ entries: { 'notes.txt': {} } } as unknown as Awaited<ReturnType<typeof unzip>>)
    const ctx = makeCtx({ isAdmin: true })

    await expect(dispatch(ctx, () => {})).rejects.toMatchObject({ status: 404 })
  })

  it('rejects missing cdg sidecars with 404', async () => {
    vi.mocked(Media.search).mockReturnValue(mockSearchResult({ pathId: 1, relPath: 'definitely-not-on-disk.mp3' }))
    const ctx = { ...makeCtx({ isAdmin: true }), query: { type: 'cdg' } }

    await expect(dispatch(ctx, () => {})).rejects.toMatchObject({ status: 404 })
  })
})

describe('Media version deletion', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  const deleteCtx = (user: object) => ({
    ...makeCtx(user),
    method: 'DELETE',
    path: '/api/media/123',
  })

  it('deletes one version and pushes library + queues (admin)', async () => {
    const ctx = deleteCtx({ isAdmin: true })

    await expect(dispatch(ctx, () => {})).resolves.toBeUndefined()
    expect(Library.deleteMedia).toHaveBeenCalledWith(123)
    expect(ctx.status).toBe(200)
    expect(ctx.body).toEqual({ mediaId: 123 })
    expect(pushQueuesAndLibrary).toHaveBeenCalled()
  })

  it('rejects deletion for a standard user', async () => {
    const ctx = deleteCtx({ isAdmin: false, permissions: {} })

    await expect(dispatch(ctx, () => {})).rejects.toMatchObject({ status: 401 })
    expect(Library.deleteMedia).not.toHaveBeenCalled()
  })

  it('maps NotFoundError to 404', async () => {
    vi.mocked(Library.deleteMedia).mockImplementationOnce(() => {
      throw new NotFoundError('mediaId 123 not found')
    })
    const ctx = deleteCtx({ isAdmin: true })

    await expect(dispatch(ctx, () => {})).rejects.toMatchObject({ status: 404 })
  })
})

describe('Media prefer flag', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  const preferCtx = (user: object) => ({
    ...makeCtx(user),
    method: 'PUT',
    path: '/api/media/123/prefer',
    request: { method: 'PUT' },
    io: { emit: vi.fn(), to: vi.fn(() => ({ emit: vi.fn() })) },
  })

  it('sets the flag and pushes queues (admin)', async () => {
    vi.mocked(Media.setPreferred).mockReturnValueOnce(7)
    const ctx = preferCtx({ isAdmin: true })

    await expect(dispatch(ctx, () => {})).resolves.toBeUndefined()
    expect(Media.setPreferred).toHaveBeenCalledWith(123, true)
    expect(ctx.status).toBe(200)
  })

  it('rejects invalid mediaIds with 422', async () => {
    const ctx = {
      ...preferCtx({ isAdmin: true }),
      path: '/api/media/abc/prefer',
    }

    await expect(dispatch(ctx, () => {})).rejects.toMatchObject({ status: 422 })
    expect(Media.setPreferred).not.toHaveBeenCalled()
  })

  it('maps NotFoundError to 404', async () => {
    vi.mocked(Media.setPreferred).mockImplementationOnce(() => {
      throw new NotFoundError('mediaId not found: 123')
    })
    const ctx = preferCtx({ isAdmin: true })

    await expect(dispatch(ctx, () => {})).rejects.toMatchObject({ status: 404 })
  })

  it('maps ValidationError to 422', async () => {
    vi.mocked(Media.setPreferred).mockImplementationOnce(() => {
      throw new ValidationError('invalid mediaId or value')
    })
    const ctx = preferCtx({ isAdmin: true })

    await expect(dispatch(ctx, () => {})).rejects.toMatchObject({ status: 422 })
  })
})

describe('Media loudness gain', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  const gainCtx = (user: object, body: object = { rgTrackGain: 2.5 }) => ({
    ...makeCtx(user),
    method: 'PUT',
    path: '/api/media/123',
    request: { method: 'PUT', body },
    io: { emit: vi.fn(), to: vi.fn(() => ({ emit: vi.fn() })) },
  })

  it('updates the gain rescaling the peak (admin)', async () => {
    vi.mocked(Media.search).mockReturnValue(mockSearchResult({ mediaId: 123, rgTrackGain: 0, rgTrackPeak: 0.5 }))
    const ctx = gainCtx({ isAdmin: true })

    await expect(dispatch(ctx, () => {})).resolves.toBeUndefined()
    expect(Media.update).toHaveBeenCalledWith(expect.objectContaining({
      mediaId: 123,
      rgTrackGain: 2.5,
      rgTrackPeak: expect.closeTo(0.5 * Math.pow(10, 2.5 / 20), 5),
    }))
    expect(ctx.status).toBe(200)
    expect(ctx.body).toEqual({ mediaId: 123, rgTrackGain: 2.5 })
  })

  it('rejects non-admins with 401', async () => {
    const ctx = gainCtx({ isAdmin: false })

    await expect(dispatch(ctx, () => {})).rejects.toMatchObject({ status: 401 })
    expect(Media.update).not.toHaveBeenCalled()
  })

  it('rejects invalid mediaIds and gains with 422', async () => {
    const badId = { ...gainCtx({ isAdmin: true }), path: '/api/media/abc' }
    await expect(dispatch(badId, () => {})).rejects.toMatchObject({ status: 422 })

    const badGain = gainCtx({ isAdmin: true }, { rgTrackGain: 99 })
    await expect(dispatch(badGain, () => {})).rejects.toMatchObject({ status: 422 })

    const missingGain = gainCtx({ isAdmin: true }, {})
    await expect(dispatch(missingGain, () => {})).rejects.toMatchObject({ status: 422 })

    expect(Media.update).not.toHaveBeenCalled()
  })

  it('maps unknown media to 404', async () => {
    vi.mocked(Media.search).mockReturnValue({ result: [], entities: {} })
    const ctx = gainCtx({ isAdmin: true })

    await expect(dispatch(ctx, () => {})).rejects.toMatchObject({ status: 404 })
    expect(Media.update).not.toHaveBeenCalled()
  })

  it('clears gain and peak on null (re-measured on next scan)', async () => {
    vi.mocked(Media.search).mockReturnValue(mockSearchResult({ mediaId: 123, rgTrackGain: 2.5, rgTrackPeak: 0.5 }))
    const ctx = gainCtx({ isAdmin: true }, { rgTrackGain: null })

    await expect(dispatch(ctx, () => {})).resolves.toBeUndefined()
    expect(Media.update).toHaveBeenCalledWith(expect.objectContaining({
      mediaId: 123,
      rgTrackGain: null,
      rgTrackPeak: null,
    }))
    expect(ctx.body).toEqual({ mediaId: 123, rgTrackGain: null })
  })
})

describe('Media move targets', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('lists configured folders with subfolders (admin)', async () => {
    const { default: getFolders } = await import('../lib/getFolders.js')
    vi.mocked(getFolders).mockImplementation(async (dir: string) => (
      dir === '/audio' ? ['/audio/set1'] : []
    ))
    vi.mocked(Prefs.get).mockReturnValue({
      paths: { result: [1], entities: { 1: { path: '/audio' } } },
    } as unknown as ReturnType<typeof Prefs.get>)
    const ctx = { ...makeCtx({ isAdmin: true }), method: 'GET', path: '/api/media/move-targets' }

    await expect(dispatch(ctx, () => {})).resolves.toBeUndefined()
    expect(ctx.body).toEqual({
      paths: [{ pathId: 1, path: '/audio', folders: ['', 'set1'] }],
    })
  })

  it('rejects non-admins with 401', async () => {
    const ctx = { ...makeCtx({ isAdmin: false }), method: 'GET', path: '/api/media/move-targets' }

    await expect(dispatch(ctx, () => {})).rejects.toMatchObject({ status: 401 })
  })
})

describe('Media version move', () => {
  const movePrefs = {
    paths: { result: [1, 2], entities: { 1: { path: '/audio' }, 2: { path: '/video' } } },
  } as unknown as ReturnType<typeof Prefs.get>

  const moveCtx = (user: object, body: object) => ({
    ...makeCtx(user),
    method: 'POST',
    path: '/api/media/123/move',
    request: { method: 'POST', body },
  })

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(Media.search).mockReturnValue(mockSearchResult({ pathId: 1, relPath: 'set1/song.mp3' }))
    vi.mocked(Prefs.get).mockReturnValue(movePrefs)
  })

  it('moves the file and updates pathId/relPath (admin)', async () => {
    const fsPromises = (await import('node:fs/promises')).default
    const fsMod = (await import('fs')).default
    vi.mocked(fsPromises.stat).mockResolvedValue({ isDirectory: () => true } as never)
    vi.mocked(fsMod.existsSync).mockReturnValue(false)
    const ctx = moveCtx({ isAdmin: true }, { destDir: '/video' })

    await expect(dispatch(ctx, () => {})).resolves.toBeUndefined()
    expect(fsMod.renameSync).toHaveBeenCalledWith('/audio/set1/song.mp3', '/video/song.mp3')
    expect(Media.update).toHaveBeenCalledWith({ mediaId: 123, pathId: 2, relPath: 'song.mp3' })
    expect(ctx.body).toEqual({ mediaId: 123, pathId: 2, relPath: 'song.mp3' })
    // cache invalidation + fresh flags reach every client
    expect(pushQueuesAndLibrary).toHaveBeenCalled()
  })

  it('moves the mp3+g sidecar along', async () => {
    const fsPromises = (await import('node:fs/promises')).default
    const fsMod = (await import('fs')).default
    vi.mocked(fsPromises.stat).mockResolvedValue({ isDirectory: () => true } as never)
    vi.mocked(fsMod.existsSync).mockReturnValue(false)
    vi.mocked(fsMod.statSync).mockImplementation(((p: unknown) => {
      if (String(p).endsWith('.cdg')) return {}
      throw new Error('ENOENT')
    }) as never)
    const ctx = moveCtx({ isAdmin: true }, { destDir: '/video/live' })

    await expect(dispatch(ctx, () => {})).resolves.toBeUndefined()
    expect(fsMod.renameSync).toHaveBeenCalledWith('/audio/set1/song.mp3', '/video/live/song.mp3')
    expect(fsMod.renameSync).toHaveBeenCalledWith('/audio/set1/song.cdg', '/video/live/song.cdg')
    expect(Media.update).toHaveBeenCalledWith({ mediaId: 123, pathId: 2, relPath: 'live/song.mp3' })
  })

  it('refuses existing destinations with 409 without touching anything', async () => {
    const fsPromises = (await import('node:fs/promises')).default
    const fsMod = (await import('fs')).default
    vi.mocked(fsPromises.stat).mockResolvedValue({ isDirectory: () => true } as never)
    vi.mocked(fsMod.existsSync).mockReturnValue(true)
    const ctx = moveCtx({ isAdmin: true }, { destDir: '/video' })

    await expect(dispatch(ctx, () => {})).rejects.toMatchObject({ status: 409 })
    expect(fsMod.renameSync).not.toHaveBeenCalled()
    expect(Media.update).not.toHaveBeenCalled()
  })

  it('rejects destinations outside media folders with 422', async () => {
    const ctx = moveCtx({ isAdmin: true }, { destDir: '/elsewhere' })

    await expect(dispatch(ctx, () => {})).rejects.toMatchObject({ status: 422 })
    expect(Media.update).not.toHaveBeenCalled()
  })

  it('rejects unknown media with 404 and non-admins with 401', async () => {
    vi.mocked(Media.search).mockReturnValue({ result: [], entities: {} })

    const missing = moveCtx({ isAdmin: true }, { destDir: '/video' })
    await expect(dispatch(missing, () => {})).rejects.toMatchObject({ status: 404 })

    const forbidden = moveCtx({ isAdmin: false }, { destDir: '/video' })
    await expect(dispatch(forbidden, () => {})).rejects.toMatchObject({ status: 401 })
  })
})
