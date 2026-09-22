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
  },
  stat: vi.fn().mockResolvedValue({ size: 1024 }),
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
import { NotFoundError } from '../lib/Errors.js'

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

  it('streams media for a room admin', async () => {
    const ctx = makeCtx({ isAdmin: false, isRoomAdmin: true })

    await expect(dispatch(ctx, () => {})).resolves.toBeUndefined()
    expect(ctx.status).toBe(200)
    expect(ctx.type).toBe('audio/mpeg')
  })

  it('streams media for an admin', async () => {
    const ctx = makeCtx({ isAdmin: true, isRoomAdmin: false })

    await expect(dispatch(ctx, () => {})).resolves.toBeUndefined()
    expect(ctx.status).toBe(200)
  })

  it('rejects streaming for a standard user', async () => {
    const ctx = makeCtx({ isAdmin: false, isRoomAdmin: false })

    await expect(dispatch(ctx, () => {})).rejects.toMatchObject({ status: 401 })
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
    const ctx = deleteCtx({ isAdmin: false, isRoomAdmin: false })

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
