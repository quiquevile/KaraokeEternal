import { describe, it, expect, vi, beforeEach } from 'vitest'

const {
  readFileMock,
  parseBufferMock,
  reqMock,
  searchMock,
} = vi.hoisted(() => ({
  readFileMock: vi.fn(),
  parseBufferMock: vi.fn(),
  reqMock: vi.fn(),
  searchMock: vi.fn(),
}))

vi.mock('node:fs/promises', () => ({
  default: { readFile: readFileMock },
  readFile: readFileMock,
}))

vi.mock('music-metadata', () => ({
  parseBuffer: parseBufferMock,
}))

vi.mock('../../lib/IPCBridge.js', () => ({
  default: { req: reqMock, send: vi.fn() },
}))

vi.mock('../../Media/Media.js', () => ({
  default: { search: searchMock },
}))

import FileScanner from './FileScanner.js'
import { LIBRARY_MATCH_SONG, MEDIA_ADD, MEDIA_UPDATE } from '../../../shared/actionTypes.js'

const FILE = '/media/song.mp4'

function makeScanner () {
  const scanner = new FileScanner(
    { paths: { entities: { 1: { path: '/media' } } } },
    { length: 1 },
  )
  scanner.parser = () => ({ artist: 'Artist', title: 'Title' })

  return scanner
}

function updates () {
  return reqMock.mock.calls
    .filter(call => call[0].type === MEDIA_UPDATE)
    .map(call => call[0].payload)
}

describe('FileScanner gain handling', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    readFileMock.mockResolvedValue(Buffer.from('audio'))
    reqMock.mockImplementation(async ({ type }) => {
      if (type === LIBRARY_MATCH_SONG) return { songId: 7, artistId: 9 }
      if (type === MEDIA_ADD) return 5

      return { mediaId: 5 }
    })
  })

  it('keeps stored gain when the file has different tags', async () => {
    parseBufferMock.mockResolvedValue({
      format: { duration: 200 },
      common: {
        replaygain_track_gain: { dB: -5 },
        replaygain_track_peak: { ratio: 0.8 },
      },
    })
    searchMock.mockReturnValue({
      result: [5],
      entities: {
        5: {
          mediaId: 5, songId: 7, pathId: 1, relPath: 'song.mp4',
          duration: 200, rgTrackGain: -3, rgTrackPeak: 1,
        },
      },
    })

    const res = await makeScanner().process({ file: FILE }, 1)

    expect(res).toEqual({ mediaId: 5, isNew: false })
    expect(updates()).toEqual([])
  })

  it('keeps stored gain when the file has no tags', async () => {
    parseBufferMock.mockResolvedValue({
      format: { duration: 200 },
      common: {},
    })
    searchMock.mockReturnValue({
      result: [5],
      entities: {
        5: {
          mediaId: 5, songId: 7, pathId: 1, relPath: 'song.mp4',
          duration: 200, rgTrackGain: -3, rgTrackPeak: 1,
        },
      },
    })

    await makeScanner().process({ file: FILE }, 1)

    // stored values must not be cleared (regression)
    expect(updates()).toEqual([])
  })

  it('stores tags when the database has no values yet', async () => {
    parseBufferMock.mockResolvedValue({
      format: { duration: 200 },
      common: {
        replaygain_track_gain: { dB: -5 },
        replaygain_track_peak: { ratio: 0.8 },
      },
    })
    searchMock.mockReturnValue({
      result: [5],
      entities: {
        5: {
          mediaId: 5, songId: 7, pathId: 1, relPath: 'song.mp4',
          duration: 200, rgTrackGain: null, rgTrackPeak: null,
        },
      },
    })

    await makeScanner().process({ file: FILE }, 1)

    expect(updates()).toEqual([
      expect.objectContaining({ mediaId: 5, rgTrackGain: -5, rgTrackPeak: 0.8 }),
    ])
  })

  it('stores tags for new files', async () => {
    parseBufferMock.mockResolvedValue({
      format: { duration: 200 },
      common: {
        replaygain_track_gain: { dB: -5 },
        replaygain_track_peak: { ratio: 0.8 },
      },
    })
    searchMock.mockReturnValue({ result: [], entities: {} })

    const res = await makeScanner().process({ file: FILE }, 1)

    expect(res).toEqual({ mediaId: 5, isNew: true })
    const adds = reqMock.mock.calls
      .filter(call => call[0].type === MEDIA_ADD)
      .map(call => call[0].payload)
    expect(adds).toEqual([
      expect.objectContaining({ rgTrackGain: -5, rgTrackPeak: 0.8 }),
    ])
  })
})
