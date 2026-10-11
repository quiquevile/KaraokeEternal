import { describe, it, expect, vi, beforeEach } from 'vitest'

const {
  readFileMock,
  parseBufferMock,
  parseFileMock,
  reqMock,
  scanRowsMock,
} = vi.hoisted(() => ({
  readFileMock: vi.fn(),
  parseBufferMock: vi.fn(),
  parseFileMock: vi.fn(),
  reqMock: vi.fn(),
  scanRowsMock: vi.fn(),
}))

vi.mock('node:fs/promises', () => ({
  default: { readFile: readFileMock },
  readFile: readFileMock,
}))

vi.mock('music-metadata', () => ({
  parseBuffer: parseBufferMock,
  parseFile: parseFileMock,
}))

vi.mock('../../lib/IPCBridge.js', () => ({
  default: { req: reqMock, send: vi.fn() },
}))

vi.mock('../../Media/Media.js', () => ({
  default: { scanRows: scanRowsMock },
}))

import FileScanner from './FileScanner.js'
import { LIBRARY_MATCH_SONG, MEDIA_ADD, MEDIA_REMOVE, MEDIA_UPDATE } from '../../../shared/actionTypes.js'

const FILE = '/media/song.mp4'
const MTIME_MS = 1790000000 * 1000
const FILE_STATS = { mtimeMs: MTIME_MS }

function makeScanner (existing: Record<string, object> = {}) {
  const scanner = new FileScanner(
    { paths: { result: [1], entities: { 1: { pathId: 1, path: '/media', priority: 0 } } } },
    { length: 1 },
  )
  scanner.parser = () => ({ artist: 'Artist', artistNorm: 'Artist', title: 'Title', titleNorm: 'Title' })
  scanner.existingMedia = existing as never

  return scanner
}

const existingRow = {
  mediaId: 5, songId: 7, pathId: 1, relPath: 'song.mp4',
  duration: 200, rgTrackGain: -3, rgTrackPeak: 1, dateUpdated: 0,
}

function updates () {
  return reqMock.mock.calls
    .filter(call => call[0].type === MEDIA_UPDATE)
    .map(call => call[0].payload)
}

describe('FileScanner gain handling', () => {
  const metadata = {
    format: { duration: 200 },
    common: {
      replaygain_track_gain: { dB: -5 },
      replaygain_track_peak: { ratio: 0.8 },
    },
  }

  beforeEach(() => {
    vi.clearAllMocks()
    readFileMock.mockResolvedValue(Buffer.from('audio'))
    parseFileMock.mockResolvedValue(metadata)
    parseBufferMock.mockResolvedValue(metadata)
    scanRowsMock.mockReturnValue({})
    reqMock.mockImplementation(async ({ type }) => {
      if (type === LIBRARY_MATCH_SONG) return { songId: 7, artistId: 9 }
      if (type === MEDIA_ADD) return 5

      return { mediaId: 5 }
    })
  })

  it('keeps stored gain when the file has different tags', async () => {
    const res = await makeScanner({ 'song.mp4': existingRow }).process({ file: FILE, stats: FILE_STATS }, 1)

    expect(res).toEqual({ mediaId: 5, isNew: false })
    // gain untouched; only the first-time mtime stamp is written
    expect(updates()).toEqual([{ mediaId: 5, dateUpdated: 1790000000 }])
  })

  it('keeps stored gain when the file has no tags', async () => {
    parseFileMock.mockResolvedValue({ format: { duration: 200 }, common: {} })

    await makeScanner({ 'song.mp4': existingRow }).process({ file: FILE, stats: FILE_STATS }, 1)

    // stored values must not be cleared (regression); only the stamp
    expect(updates()).toEqual([{ mediaId: 5, dateUpdated: 1790000000 }])
  })

  it('stores tags when the database has no values yet', async () => {
    const row = { ...existingRow, rgTrackGain: null, rgTrackPeak: null }

    await makeScanner({ 'song.mp4': row }).process({ file: FILE, stats: FILE_STATS }, 1)

    expect(updates()).toEqual([
      expect.objectContaining({ mediaId: 5, rgTrackGain: -5, rgTrackPeak: 0.8 }),
    ])
  })

  it('stores tags for new files', async () => {
    const res = await makeScanner().process({ file: FILE, stats: FILE_STATS }, 1)

    expect(res).toEqual({ mediaId: 5, isNew: true })
    const adds = reqMock.mock.calls
      .filter(call => call[0].type === MEDIA_ADD)
      .map(call => call[0].payload)
    expect(adds).toEqual([
      expect.objectContaining({ rgTrackGain: -5, rgTrackPeak: 0.8 }),
    ])
  })
})

describe('FileScanner unchanged skip', () => {
  const stampedRow = { ...existingRow, dateUpdated: 1790000000 }

  beforeEach(() => {
    vi.clearAllMocks()
    reqMock.mockImplementation(async ({ type }) => {
      if (type === LIBRARY_MATCH_SONG) return { songId: 7, artistId: 9 }
      if (type === MEDIA_ADD) return 5

      return { mediaId: 5 }
    })
  })

  it('skips parsing when mtime matches the stamped value', async () => {
    const res = await makeScanner({ 'song.mp4': stampedRow }).process({ file: FILE, stats: FILE_STATS }, 1)

    expect(res).toEqual({ mediaId: 5, isNew: false })
    expect(parseFileMock).not.toHaveBeenCalled()
    expect(readFileMock).not.toHaveBeenCalled()
    expect(reqMock).not.toHaveBeenCalled()
  })

  it('reprocesses when mtime differs and stamps the new value', async () => {
    parseFileMock.mockResolvedValue({ format: { duration: 200 }, common: {} })

    const res = await makeScanner({ 'song.mp4': stampedRow })
      .process({ file: FILE, stats: { mtimeMs: (1790000001) * 1000 } }, 1)

    expect(res).toEqual({ mediaId: 5, isNew: false })
    expect(parseFileMock).toHaveBeenCalled()
    expect(updates()).toEqual([
      expect.objectContaining({ mediaId: 5, dateUpdated: 1790000001 }),
    ])
  })

  it('reprocesses rows never stamped (dateUpdated 0)', async () => {
    parseFileMock.mockResolvedValue({ format: { duration: 200 }, common: {} })

    await makeScanner({ 'song.mp4': existingRow }).process({ file: FILE, stats: FILE_STATS }, 1)

    expect(parseFileMock).toHaveBeenCalled()
  })
})

describe('FileScanner removeInvalid', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    reqMock.mockResolvedValue({ mediaId: 5 })
  })

  it('removes only rows missing from the scan', async () => {
    scanRowsMock.mockReturnValue({
      'gone.mp4': { mediaId: 9, pathId: 1, relPath: 'gone.mp4' },
      'song.mp4': { mediaId: 5, pathId: 1, relPath: 'song.mp4' },
    })

    const removed = await makeScanner().removeInvalid(1, new Set([5]))

    expect(removed).toBe(1)
    expect(reqMock).toHaveBeenCalledWith({ type: MEDIA_REMOVE, payload: [9] })
  })

  it('does nothing when everything is valid', async () => {
    scanRowsMock.mockReturnValue({
      'song.mp4': { mediaId: 5, pathId: 1, relPath: 'song.mp4' },
    })

    expect(await makeScanner().removeInvalid(1, new Set([5]))).toBe(0)
    expect(reqMock).not.toHaveBeenCalled()
  })
})
