import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('./ytdlp.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./ytdlp.js')>()
  return {
    ...actual,
    searchYoutube: vi.fn(),
    resolveStreamUrl: vi.fn(),
  }
})

vi.mock('../Prefs/Prefs.js', () => ({
  default: { get: vi.fn() },
}))

vi.mock('./library.js', () => ({
  getAlreadyDownloadedIds: vi.fn(),
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

import {
  handleSearch,
  handleIdentify,
  handleStream,
  handleDownload,
  handleDownloads,
  handleDownloadsClear,
  handleDownloadsDelete,
  resolveDownloadPath,
} from './router.js'
import { searchYoutube, resolveStreamUrl, setYtdlBin, getYtdlBin } from './ytdlp.js'
import Prefs from '../Prefs/Prefs.js'
import { getAlreadyDownloadedIds } from './library.js'
import { downloadManager } from './downloadManager.js'
import type { DownloadJob, DownloadReport } from './downloadManager.js'
import type { RouterContext } from './router.js'
import type { YouTubeResult } from './ytdlp.js'

interface MockPrefs {
  paths: { result: number[], entities: Record<number, { path: string }> }
  youtubeDownloadPathId?: number
  youtubeDlBin?: string
  youtubeDlExtraArgs?: string
}

function makeCtx (overrides: Record<string, unknown> = {}): RouterContext {
  return {
    user: { isAdmin: true },
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
    vi.mocked(Prefs.get).mockReturnValue(mockedPrefs())
  })

  describe('handleSearch', () => {
    it('returns results with alreadyDownloaded flags', async () => {
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
      vi.mocked(getAlreadyDownloadedIds).mockReturnValue(new Set(['idA']))

      const ctx = makeCtx({ request: { body: { query: 'Dancing Queen' } } })
      await handleSearch(ctx)

      expect(searchYoutube).toHaveBeenCalledWith('Dancing Queen')
      expect(getAlreadyDownloadedIds).toHaveBeenCalledWith(['idA', 'idB'])
      expect(ctx.body).toEqual({
        results: [
          { ...a, alreadyDownloaded: true },
          { ...b, alreadyDownloaded: false },
        ],
      })
    })

    it('rejects an empty query', async () => {
      const ctx = makeCtx({ request: { body: { query: '   ' } } })
      await expect(handleSearch(ctx)).rejects.toSatisfy(throwStatus(422))
    })

    it('requires admin', async () => {
      const ctx = makeCtx({ user: { isAdmin: false }, request: { body: { query: 'x' } } })
      await expect(handleSearch(ctx)).rejects.toSatisfy(throwStatus(401))
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
          destDir: '/media/musica',
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

    it('applies the configured yt-dlp binary from prefs', async () => {
      vi.mocked(Prefs.get).mockReturnValue(mockedPrefs({ youtubeDlBin: '/prefs/bin/yt-dlp' }))
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
  })

  describe('handleDownloads', () => {
    it('returns the current manager status', async () => {
      const status: DownloadReport = { active: null, queue: [], history: [] }
      vi.mocked(downloadManager.getStatus).mockReturnValue(status)

      const ctx = makeCtx()
      await handleDownloads(ctx)

      expect(ctx.body).toBe(status)
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

    it('requires admin', async () => {
      const ctx = makeCtx({ user: { isAdmin: false } })
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

    it('requires admin', async () => {
      const ctx = makeCtx({ user: { isAdmin: false }, params: { id: 'abc123' } })
      await expect(handleDownloadsDelete(ctx)).rejects.toSatisfy(throwStatus(401))
      expect(downloadManager.removeHistory).not.toHaveBeenCalled()
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
