import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mkdirMock } = vi.hoisted(() => ({ mkdirMock: vi.fn() }))

vi.mock('node:fs/promises', () => ({
  default: {
    mkdir: mkdirMock,
  },
  mkdir: mkdirMock,
}))

vi.mock('./ytdlp.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./ytdlp.js')>()
  return {
    ...actual,
    searchYoutube: vi.fn(),
    resolveVideo: vi.fn(),
    resolveStreamUrl: vi.fn(),
    getYtdlStatus: vi.fn(),
    updateYtdl: vi.fn(),
    getYtdlMode: vi.fn(),
  }
})

vi.mock('../Prefs/Prefs.js', () => ({
  default: { get: vi.fn() },
}))

vi.mock('./downloadManager.js', () => ({
  downloadManager: {
    enqueue: vi.fn(),
    getStatus: vi.fn(),
    bindIo: vi.fn(),
    clearHistory: vi.fn(),
    removeHistory: vi.fn(),
  },
}))

vi.mock('./registerDownload.js', () => ({
  findDownloadedFile: vi.fn(async () => null),
}))

vi.mock('../Library/Library.js', () => ({
  default: {
    findSong: vi.fn(() => null),
  },
}))

import {
  handleSearch,
  handleIdentify,
  handleStream,
  handleDownload,
  handleDownloads,
  handleDownloadsClear,
  handleDownloadsDelete,
  handleYtdlVersion,
  handleYtdlUpdate,
  resolveDownloadPath,
} from './router.js'
import {
  searchYoutube,
  resolveVideo,
  resolveStreamUrl,
  setYtdlBin,
  setYtdlDir,
  getYtdlBin,
  getYtdlStatus,
  updateYtdl,
  getYtdlMode,
} from './ytdlp.js'
import Prefs from '../Prefs/Prefs.js'
import { downloadManager } from './downloadManager.js'
import { findDownloadedFile } from './registerDownload.js'
import Library from '../Library/Library.js'
import type { DownloadJob, DownloadReport } from './downloadManager.js'
import type { RouterContext } from './router.js'
import type { YouTubeResult } from './ytdlp.js'

interface MockPrefs {
  paths: { result: number[], entities: Record<number, { path: string }> }
  youtubeDownloadPathId?: number
  youtubeYtdlDir?: string
  youtubeDlExtraArgs?: string
}

function makeCtx (overrides: Record<string, unknown> = {}): RouterContext {
  return {
    user: { isAdmin: true, username: 'tester' },
    params: {},
    query: {},
    request: { body: {} },
    body: undefined,
    status: 200,
    throw (status: number, message?: string): never {
      const err = new Error(message ?? String(status)) as Error & { status: number }
      err.status = status
      throw err
    },
    ...overrides,
  } as RouterContext
}

function throwStatus (status: number) {
  return (err: Error) => {
    expect((err as Error & { status: number }).status).toBe(status)

    return true
  }
}

function makePrefs (overrides: Partial<MockPrefs> = {}): MockPrefs {
  return {
    paths: { result: [1], entities: { 1: { path: '/media/musica' } } },
    youtubeDownloadPathId: 1,
    youtubeYtdlDir: '/data/bin',
    youtubeDlExtraArgs: '',
    ...overrides,
  }
}

function mockedPrefs (overrides: Partial<MockPrefs> = {}) {
  return makePrefs(overrides) as unknown as ReturnType<typeof Prefs.get>
}

describe('router', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setYtdlBin(null)
    setYtdlDir(null)
    vi.mocked(Prefs.get).mockReturnValue(mockedPrefs())
    vi.mocked(getYtdlMode).mockReturnValue('system')
  })

  describe('handleSearch', () => {
    it('returns search results', async () => {
      const a: YouTubeResult = {
        id: 'idA',
        url: 'https://youtu.be/idA',
        title: 'A',
        artist: 'Chan',
        duration: 120,
        durationLabel: '2:00',
        thumbnail: 'https://img.youtube.com/vi/idA/mqdefault.jpg',
      }
      const b: YouTubeResult = {
        id: 'idB',
        url: 'https://youtu.be/idB',
        title: 'B',
        artist: 'Chan',
        duration: 120,
        durationLabel: '2:00',
        thumbnail: 'https://img.youtube.com/vi/idB/mqdefault.jpg',
      }
      vi.mocked(searchYoutube).mockResolvedValue([a, b])

      const ctx = makeCtx({ request: { body: { query: 'Dancing Queen' } } })
      await handleSearch(ctx)

      expect(searchYoutube).toHaveBeenCalledWith('Dancing Queen')
      expect(ctx.body).toEqual({ results: [a, b] })
    })

    it('rejects an empty query', async () => {
      const ctx = makeCtx({ request: { body: { query: '   ' } } })
      await expect(handleSearch(ctx)).rejects.toSatisfy(throwStatus(422))
    })

    it('resolves a pasted YouTube URL to a single result', async () => {
      const video: YouTubeResult = {
        id: 'dQw4w9WgXcQ',
        url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
        title: 'Dancing Queen (Karaoke Version)',
        artist: 'SingKing Karaoke',
        duration: 240,
        durationLabel: '4:00',
        thumbnail: 'https://img.youtube.com/vi/dQw4w9WgXcQ/mqdefault.jpg',
      }
      vi.mocked(resolveVideo).mockResolvedValue(video)

      const ctx = makeCtx({
        request: { body: { query: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' } },
      })
      await handleSearch(ctx)

      expect(resolveVideo).toHaveBeenCalledWith('https://www.youtube.com/watch?v=dQw4w9WgXcQ')
      expect(searchYoutube).not.toHaveBeenCalled()
      expect(ctx.body).toEqual({ results: [video] })
    })

    it('falls back to search when the query is text even if it prefixes a URL', async () => {
      vi.mocked(searchYoutube).mockResolvedValue([])

      const ctx = makeCtx({
        request: { body: { query: 'Dancing Queen https://youtu.be/dQw4w9WgXcQ' } },
      })
      await handleSearch(ctx)

      expect(searchYoutube).toHaveBeenCalledWith('Dancing Queen https://youtu.be/dQw4w9WgXcQ')
      expect(resolveVideo).not.toHaveBeenCalled()
    })

    it('requires youtubeDownload permission', async () => {
      const ctx = makeCtx({ user: { isAdmin: false, permissions: {} }, request: { body: { query: 'x' } } })
      await expect(handleSearch(ctx)).rejects.toSatisfy(throwStatus(401))
    })

    it('allows non-admin with youtubeDownload permission', async () => {
      vi.mocked(searchYoutube).mockResolvedValue([])
      const ctx = makeCtx({ user: { isAdmin: false, permissions: { youtubeDownload: true } }, request: { body: { query: 'x' } } })
      await handleSearch(ctx)
      expect(searchYoutube).toHaveBeenCalledWith('x')
    })

    it('rejects 422 when no yt-dlp folder is configured', async () => {
      vi.mocked(Prefs.get).mockReturnValue(mockedPrefs({ youtubeYtdlDir: undefined }))

      const ctx = makeCtx({ request: { body: { query: 'Dancing Queen' } } })
      await expect(handleSearch(ctx)).rejects.toSatisfy(throwStatus(422))
      expect(searchYoutube).not.toHaveBeenCalled()
    })
  })

  describe('handleIdentify', () => {
    it('returns derived metadata', async () => {
      const ctx = makeCtx({
        request: { body: { title: 'Dancing Queen (Karaoke)', channel: 'SingKing' } },
      })
      await handleIdentify(ctx)

      expect(ctx.body).toEqual({
        artist: 'SingKing',
        artistNorm: 'SingKing',
        title: 'Dancing Queen',
        titleNorm: 'Dancing Queen',
      })
    })

    it('rejects a missing title', async () => {
      const ctx = makeCtx({ request: { body: { channel: 'SingKing' } } })
      await expect(handleIdentify(ctx)).rejects.toSatisfy(throwStatus(422))
    })
    it('requires youtubeDownload permission', async () => {
      const ctx = makeCtx({ user: { isAdmin: false, permissions: {} } })
      await expect(handleIdentify(ctx)).rejects.toSatisfy(throwStatus(401))
    })
  })

  describe('handleStream', () => {
    it('returns the stream URL for a valid YouTube URL', async () => {
      vi.mocked(resolveStreamUrl).mockResolvedValue('https://redirect.example/stream')
      const ctx = makeCtx({ query: { url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' } })
      await handleStream(ctx)

      expect(resolveStreamUrl).toHaveBeenCalledWith('https://www.youtube.com/watch?v=dQw4w9WgXcQ')
      expect(ctx.body).toEqual({ url: 'https://redirect.example/stream' })
    })

    it('rejects non-YouTube URLs', async () => {
      const ctx = makeCtx({ query: { url: 'https://evil.example/x' } })
      await expect(handleStream(ctx)).rejects.toSatisfy(throwStatus(422))
      expect(resolveStreamUrl).not.toHaveBeenCalled()
    })

    it('rejects 422 when no yt-dlp folder is configured', async () => {
      vi.mocked(Prefs.get).mockReturnValue(mockedPrefs({ youtubeYtdlDir: undefined }))

      const ctx = makeCtx({ query: { url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' } })
      await expect(handleStream(ctx)).rejects.toSatisfy(throwStatus(422))
      expect(resolveStreamUrl).not.toHaveBeenCalled()
    })

    it('requires youtubeDownload permission', async () => {
      const ctx = makeCtx({ user: { isAdmin: false, permissions: {} } })
      await expect(handleStream(ctx)).rejects.toSatisfy(throwStatus(401))
    })
  })

  describe('handleDownload', () => {
    it('enqueues a job with resolved metadata and path', async () => {
      const job = { id: 'abc', status: 'queued' } as DownloadJob
      vi.mocked(downloadManager.enqueue).mockReturnValue(job)

      const ctx = makeCtx({
        request: {
          body: {
            url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
            artist: 'ABBA',
            title: 'Dancing Queen',
            thumbnail: 'https://img.youtube.com/vi/dQw4w9WgXcQ/mqdefault.jpg',
          },
        },
      })
      await handleDownload(ctx)

      expect(downloadManager.enqueue).toHaveBeenCalledWith(
        expect.objectContaining({
          url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
          artist: 'ABBA',
          artistNorm: 'ABBA',
          title: 'Dancing Queen',
          titleNorm: 'Dancing Queen',
          baseName: 'ABBA - Dancing Queen',
          destDir: '/media/musica/tester',
          pathRoot: '/media/musica',
          pathId: 1,
          thumbnail: 'https://img.youtube.com/vi/dQw4w9WgXcQ/mqdefault.jpg',
          extraArgs: [],
        }),
      )
      expect(ctx.body).toBe(job)
    })

    it('auto-selects the path when only one folder exists', async () => {
      vi.mocked(Prefs.get).mockReturnValue(mockedPrefs({ youtubeDownloadPathId: undefined }))
      vi.mocked(downloadManager.enqueue).mockReturnValue({ id: 'abc' } as DownloadJob)

      const ctx = makeCtx({
        request: { body: { url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', artist: 'ABBA', title: 'Dancing Queen' } },
      })
      await handleDownload(ctx)

      expect(downloadManager.enqueue).toHaveBeenCalledWith(expect.objectContaining({ pathId: 1 }))
    })

    it('applies the configured yt-dlp folder from prefs', async () => {
      vi.mocked(Prefs.get).mockReturnValue(mockedPrefs({ youtubeYtdlDir: '/prefs/bin' }))
      vi.mocked(downloadManager.enqueue).mockReturnValue({ id: 'abc' } as DownloadJob)

      const ctx = makeCtx({
        request: { body: { url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', artist: 'ABBA', title: 'Dancing Queen' } },
      })
      await handleDownload(ctx)

      expect(getYtdlBin()).toBe('/prefs/bin/yt-dlp')
    })

    it('rejects when no media folder exists', async () => {
      vi.mocked(Prefs.get).mockReturnValue(mockedPrefs({ paths: { result: [], entities: {} }, youtubeDownloadPathId: undefined }))

      const ctx = makeCtx({
        request: { body: { url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', artist: 'ABBA', title: 'Dancing Queen' } },
      })
      await expect(handleDownload(ctx)).rejects.toSatisfy(throwStatus(422))
      expect(downloadManager.enqueue).not.toHaveBeenCalled()
    })

    it('rejects missing artist or title', async () => {
      const ctx = makeCtx({
        request: { body: { url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', artist: 'ABBA' } },
      })
      await expect(handleDownload(ctx)).rejects.toSatisfy(throwStatus(422))
    })

    it('rejects invalid URLs', async () => {
      const ctx = makeCtx({
        request: { body: { url: 'https://evil.example/x', artist: 'ABBA', title: 'Dancing Queen' } },
      })
      await expect(handleDownload(ctx)).rejects.toSatisfy(throwStatus(422))
    })

    it('downloads into a subfolder named after the user', async () => {
      vi.mocked(downloadManager.enqueue).mockReturnValue({ id: 'abc' } as DownloadJob)

      const ctx = makeCtx({
        user: { isAdmin: true, username: 'pepe' },
        request: { body: { url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', artist: 'ABBA', title: 'Dancing Queen' } },
      })
      await handleDownload(ctx)

      expect(mkdirMock).toHaveBeenCalledWith('/media/musica/pepe', { recursive: true })
      expect(downloadManager.enqueue).toHaveBeenCalledWith(expect.objectContaining({
        destDir: '/media/musica/pepe',
        pathRoot: '/media/musica',
      }))
    })

    it('sanitizes the username for the subfolder', async () => {
      vi.mocked(downloadManager.enqueue).mockReturnValue({ id: 'abc' } as DownloadJob)

      const ctx = makeCtx({
        user: { isAdmin: true, username: 'a/b:c' },
        request: { body: { url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', artist: 'ABBA', title: 'Dancing Queen' } },
      })
      await handleDownload(ctx)

      expect(downloadManager.enqueue).toHaveBeenCalledWith(expect.objectContaining({
        destDir: '/media/musica/a b c',
      }))
    })

    it('rejects 422 without a username', async () => {
      const ctx = makeCtx({
        user: { isAdmin: true, username: '  ' },
        request: { body: { url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', artist: 'ABBA', title: 'Dancing Queen' } },
      })
      await expect(handleDownload(ctx)).rejects.toSatisfy(throwStatus(422))
      expect(downloadManager.enqueue).not.toHaveBeenCalled()
    })

    it('rejects 409 when the song already exists without enqueueing', async () => {
      vi.mocked(Library.findSong).mockReturnValueOnce(7)

      const ctx = makeCtx({
        request: { body: { url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', artist: 'ABBA', title: 'Dancing Queen' } },
      })
      const err = await handleDownload(ctx).then(() => null, (e: Error) => e)

      expect(err).toMatchObject({ status: 409 })
      expect(String((err as Error)?.message)).toContain('already has that artist and title')
      expect(downloadManager.enqueue).not.toHaveBeenCalled()
    })

    it('rejects 409 when the destination file exists without enqueueing', async () => {
      vi.mocked(findDownloadedFile).mockResolvedValueOnce('/media/musica/ABBA - Dancing Queen.mp4')

      const ctx = makeCtx({
        request: { body: { url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', artist: 'ABBA', title: 'Dancing Queen' } },
      })
      const err = await handleDownload(ctx).then(() => null, (e: Error) => e)

      expect(err).toMatchObject({ status: 409 })
      expect(String((err as Error)?.message)).toContain('File already exists')
      expect(findDownloadedFile).toHaveBeenCalledWith('/media/musica/tester', 'ABBA - Dancing Queen')
      expect(downloadManager.enqueue).not.toHaveBeenCalled()
    })

    it('rejects 422 when no yt-dlp folder is configured', async () => {
      vi.mocked(Prefs.get).mockReturnValue(mockedPrefs({ youtubeYtdlDir: undefined }))

      const ctx = makeCtx({
        request: { body: { url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', artist: 'ABBA', title: 'Dancing Queen' } },
      })
      await expect(handleDownload(ctx)).rejects.toSatisfy(throwStatus(422))
      expect(downloadManager.enqueue).not.toHaveBeenCalled()
    })

    it('requires youtubeDownload permission', async () => {
      const ctx = makeCtx({ user: { isAdmin: false, permissions: {} } })
      await expect(handleDownload(ctx)).rejects.toSatisfy(throwStatus(401))
      expect(downloadManager.enqueue).not.toHaveBeenCalled()
    })
  })

  describe('handleDownloads', () => {
    it('returns the current manager status', async () => {
      const status: DownloadReport = { active: null, queue: [], history: [] }
      vi.mocked(downloadManager.getStatus).mockReturnValue(status)

      const ctx = makeCtx()
      await handleDownloads(ctx)

      expect(ctx.body).toBe(status)
    })

    it('requires youtubeDownload permission', async () => {
      const ctx = makeCtx({ user: { isAdmin: false, permissions: {} } })
      await expect(handleDownloads(ctx)).rejects.toSatisfy(throwStatus(401))
      expect(downloadManager.getStatus).not.toHaveBeenCalled()
    })
  })

  describe('handleDownloadsClear', () => {
    it('clears the download history and returns the new status', async () => {
      const status: DownloadReport = { active: null, queue: [], history: [] }
      vi.mocked(downloadManager.getStatus).mockReturnValue(status)

      const ctx = makeCtx()
      await handleDownloadsClear(ctx)

      expect(downloadManager.clearHistory).toHaveBeenCalledWith()
      expect(ctx.body).toBe(status)
    })

    it('requires youtubeDownload permission', async () => {
      const ctx = makeCtx({ user: { isAdmin: false, permissions: {} } })
      await expect(handleDownloadsClear(ctx)).rejects.toSatisfy(throwStatus(401))
      expect(downloadManager.clearHistory).not.toHaveBeenCalled()
    })
  })

  describe('handleDownloadsDelete', () => {
    it('removes the job from the download history and returns the new status', async () => {
      const status: DownloadReport = { active: null, queue: [], history: [] }
      vi.mocked(downloadManager.getStatus).mockReturnValue(status)

      const ctx = makeCtx({ params: { id: 'abc123' } })
      await handleDownloadsDelete(ctx)

      expect(downloadManager.removeHistory).toHaveBeenCalledWith('abc123')
      expect(ctx.body).toBe(status)
    })

    it('requires youtubeDownload permission', async () => {
      const ctx = makeCtx({ user: { isAdmin: false, permissions: {} }, params: { id: 'abc123' } })
      await expect(handleDownloadsDelete(ctx)).rejects.toSatisfy(throwStatus(401))
      expect(downloadManager.removeHistory).not.toHaveBeenCalled()
    })
  })

  describe('handleYtdlVersion', () => {
    it('returns the yt-dlp status and mode', async () => {
      vi.mocked(getYtdlStatus).mockResolvedValue({
        version: '2025.12.17',
        mode: 'managed',
        status: 'ready',
        updatedAt: 1789729305000,
        dir: '/config/bin',
      })

      const ctx = makeCtx()
      await handleYtdlVersion(ctx)

      expect(getYtdlStatus).toHaveBeenCalled()
      expect(ctx.body).toEqual({
        version: '2025.12.17',
        mode: 'managed',
        status: 'ready',
        updatedAt: 1789729305000,
        dir: '/config/bin',
      })
    })

    it('requires admin', async () => {
      const ctx = makeCtx({ user: { isAdmin: false } })
      await expect(handleYtdlVersion(ctx)).rejects.toSatisfy(throwStatus(401))
      expect(getYtdlStatus).not.toHaveBeenCalled()
    })
  })

  describe('handleYtdlUpdate', () => {
    it('updates yt-dlp and returns ok/version/output/mode', async () => {
      vi.mocked(updateYtdl).mockResolvedValue({
        ok: true,
        version: '2025.12.17',
        output: 'Updated to 2025.12.17',
      })
      vi.mocked(getYtdlMode).mockReturnValue('managed')

      const ctx = makeCtx()
      await handleYtdlUpdate(ctx)

      expect(updateYtdl).toHaveBeenCalled()
      expect(ctx.body).toEqual({
        ok: true,
        version: '2025.12.17',
        output: 'Updated to 2025.12.17',
        mode: 'managed',
      })
    })

    it('requires admin', async () => {
      const ctx = makeCtx({ user: { isAdmin: false } })
      await expect(handleYtdlUpdate(ctx)).rejects.toSatisfy(throwStatus(401))
      expect(updateYtdl).not.toHaveBeenCalled()
    })

    it('rejects 422 when no yt-dlp folder is configured', async () => {
      vi.mocked(Prefs.get).mockReturnValue(mockedPrefs({ youtubeYtdlDir: undefined }))

      const ctx = makeCtx()
      await expect(handleYtdlUpdate(ctx)).rejects.toSatisfy(throwStatus(422))
      expect(updateYtdl).not.toHaveBeenCalled()
    })
  })

  describe('resolveDownloadPath', () => {
    it('returns the selected path', () => {
      expect(resolveDownloadPath(makePrefs())).toEqual({ pathId: 1, destDir: '/media/musica' })
    })

    it('falls back to the first path when not configured', () => {
      const prefs = makePrefs({ paths: { result: [1, 2], entities: { 1: { path: '/a' }, 2: { path: '/b' } } }, youtubeDownloadPathId: undefined })
      expect(resolveDownloadPath(prefs)).toEqual({ pathId: 1, destDir: '/a' })
    })

    it('falls back to the first path when the selected path no longer exists', () => {
      const prefs = makePrefs({ paths: { result: [2, 3], entities: { 2: { path: '/b' }, 3: { path: '/c' } } }, youtubeDownloadPathId: 1 })
      expect(resolveDownloadPath(prefs)).toEqual({ pathId: 2, destDir: '/b' })
    })

    it('returns null when there are no paths', () => {
      const prefs = makePrefs({ paths: { result: [], entities: {} }, youtubeDownloadPathId: undefined })
      expect(resolveDownloadPath(prefs)).toBeNull()
    })
  })
})
