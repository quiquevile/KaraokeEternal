import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('fs', () => ({
  default: {
    createReadStream: vi.fn().mockReturnValue({ on: vi.fn() }),
  },
  createReadStream: vi.fn().mockReturnValue({ on: vi.fn() }),
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

vi.mock('../Media/Media.js', () => ({
  default: {
    search: vi.fn(),
    setPreferred: vi.fn(),
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
}))

vi.mock('../Rooms/Rooms.js', () => ({
  default: {
    getActive: vi.fn(() => []),
  },
}))

import router from './router.js'
import Media from '../Media/Media.js'
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
    vi.mocked(Media.search).mockReturnValue({
      result: [123],
      entities: { 123: { pathId: 1, relPath: 'file.unknown' } },
    })
    const ctx = makeCtx({ isAdmin: true })

    await expect(dispatch(ctx, () => {})).rejects.toMatchObject({ status: 404 })
  })

  it('streams the audio entry of a zip archive', async () => {
    vi.mocked(Media.search).mockReturnValue({
      result: [123],
      entities: { 123: { pathId: 1, relPath: 'archive.zip' } },
    })
    vi.mocked(unzip).mockResolvedValue({
      entries: {
        'track.mp3': { size: 100, arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer },
      },
    })
    const ctx = makeCtx({ isAdmin: true })

    await expect(dispatch(ctx, () => {})).resolves.toBeUndefined()
    expect(ctx.status).toBe(200)
    expect(ctx.type).toBe('audio/mpeg')
  })

  it('streams the cdg sidecar of a zip archive', async () => {
    vi.mocked(Media.search).mockReturnValue({
      result: [123],
      entities: { 123: { pathId: 1, relPath: 'archive.zip' } },
    })
    vi.mocked(unzip).mockResolvedValue({
      entries: {
        'track.mp3': { size: 100, arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer },
        'track.cdg': { size: 50, arrayBuffer: async () => new Uint8Array([4, 5]).buffer },
      },
    })
    const ctx = { ...makeCtx({ isAdmin: true }), query: { type: 'cdg' } }

    await expect(dispatch(ctx, () => {})).resolves.toBeUndefined()
    expect(ctx.status).toBe(200)
  })

  it('rejects zips without a valid audio entry with 404', async () => {
    vi.mocked(Media.search).mockReturnValue({
      result: [123],
      entities: { 123: { pathId: 1, relPath: 'archive.zip' } },
    })
    vi.mocked(unzip).mockResolvedValue({ entries: { 'notes.txt': {} } })
    const ctx = makeCtx({ isAdmin: true })

    await expect(dispatch(ctx, () => {})).rejects.toMatchObject({ status: 404 })
  })

  it('rejects missing cdg sidecars with 404', async () => {
    vi.mocked(Media.search).mockReturnValue({
      result: [123],
      entities: { 123: { pathId: 1, relPath: 'definitely-not-on-disk.mp3' } },
    })
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
