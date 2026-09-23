import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

vi.mock('child_process', () => ({
  execFile: vi.fn(),
}))

vi.mock('../Library/Library.js', () => ({
  default: {
    matchSong: vi.fn(() => ({ songId: 1, artistId: 2 })),
  },
}))

vi.mock('../Media/Media.js', () => ({
  default: {
    search: vi.fn(() => ({ result: [], entities: {} })),
    add: vi.fn(() => 10),
  },
}))

vi.mock('../lib/pushQueuesAndLibrary.js', () => ({
  default: vi.fn(),
}))

import { execFile } from 'child_process'
import Library from '../Library/Library.js'
import Media from '../Media/Media.js'
import pushQueuesAndLibrary from '../lib/pushQueuesAndLibrary.js'
import registerDownload, { findDownloadedFile } from './registerDownload.js'
import type { DownloadJob } from './downloadManager.js'

let dir: string

beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), 'ke-find-download-test-'))
  writeFileSync(join(dir, 'ABBA - Dancing Queen.mp4'), 'video')
  writeFileSync(join(dir, 'ABBA - Dancing Queen.mp3'), 'audio without video')
  writeFileSync(join(dir, 'ABBA - Dancing Queen.txt'), 'notes')
  writeFileSync(join(dir, 'ABBA - Other Song.webm'), 'video')
  writeFileSync(join(dir, 'Solo - Audio.mp3'), 'audio without video')
})

afterAll(() => {
  rmSync(dir, { recursive: true, force: true })
})

describe('findDownloadedFile', () => {
  it('locates the video file matching the base name', async () => {
    await expect(findDownloadedFile(dir, 'ABBA - Dancing Queen'))
      .resolves.toBe(join(dir, 'ABBA - Dancing Queen.mp4'))
  })

  it('returns null when only a non-video file matches', async () => {
    // .mp3 audio alone is not a downloadable video artifact
    await expect(findDownloadedFile(dir, 'Solo - Audio')).resolves.toBeNull()
  })

  it('returns null when nothing matches', async () => {
    await expect(findDownloadedFile(dir, 'Nobody - Nothing')).resolves.toBeNull()
  })
})

describe('registerDownload', () => {
  const job = {
    id: 'vid1',
    artist: 'ABBA',
    artistNorm: 'ABBA',
    title: 'Dancing Queen',
    titleNorm: 'Dancing Queen',
    destDir: '',
    pathRoot: '',
    pathId: 1,
    baseName: 'ABBA - Dancing Queen',
    thumbnail: null,
  } as unknown as DownloadJob

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(Media.search).mockReturnValue({ result: [], entities: {} })
    vi.mocked(Library.matchSong).mockReturnValue({ songId: 1, artistId: 2 })
    vi.mocked(execFile).mockImplementation((_bin, _args, cb) => {
      (cb as (err: Error | null, stdout: string) => void)(null, '240.4\n')
      return undefined as never
    })
  })

  it('matches the song, probes duration and registers the media', async () => {
    const io = {}

    await registerDownload({ job: { ...job, destDir: dir, pathRoot: dir }, io })

    expect(Library.matchSong).toHaveBeenCalledWith({
      artist: 'ABBA',
      artistNorm: 'ABBA',
      title: 'Dancing Queen',
      titleNorm: 'Dancing Queen',
    })
    expect(Media.add).toHaveBeenCalledWith(expect.objectContaining({
      songId: 1,
      duration: 240,
      pathId: 1,
      relPath: 'ABBA - Dancing Queen.mp4',
    }))
    expect(pushQueuesAndLibrary).toHaveBeenCalledWith(io)
  })

  it('registers with duration 0 when ffprobe fails', async () => {
    vi.mocked(execFile).mockImplementation((_bin, _args, cb) => {
      (cb as (err: Error | null, stdout: string) => void)(new Error('no ffprobe'), '')
      return undefined as never
    })

    await registerDownload({ job: { ...job, destDir: dir, pathRoot: dir }, io: {} })

    expect(Media.add).toHaveBeenCalledWith(expect.objectContaining({ duration: 0 }))
  })

  it('throws when the downloaded file is missing', async () => {
    await expect(registerDownload({
      job: { ...job, destDir: dir, pathRoot: dir, baseName: 'Nobody - Nothing' },
      io: {},
    })).rejects.toThrow('could not locate downloaded file')
    expect(Media.add).not.toHaveBeenCalled()
  })

  it('throws without registering when the file is already registered', async () => {
    vi.mocked(Media.search).mockReturnValue({
      result: [10],
      entities: { 10: { mediaId: 10 } },
    })

    await expect(registerDownload({
      job: { ...job, destDir: dir, pathRoot: dir },
      io: {},
    })).rejects.toThrow('already registered')
    expect(Media.add).not.toHaveBeenCalled()
  })
})
