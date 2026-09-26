import { describe, it, expect, vi, beforeEach } from 'vitest'

const {
  dbAllMock,
  dbGetMock,
  measureMock,
  readTagGainMock,
  updateMock,
  prefsGetMock,
  pushMock,
} = vi.hoisted(() => ({
  dbAllMock: vi.fn(),
  dbGetMock: vi.fn(),
  measureMock: vi.fn(),
  readTagGainMock: vi.fn(),
  updateMock: vi.fn(),
  prefsGetMock: vi.fn(),
  pushMock: vi.fn(),
}))

vi.mock('../lib/Database.js', () => ({
  db: { all: dbAllMock, get: dbGetMock },
}))

vi.mock('../lib/loudness.js', () => ({
  measureLoudness: measureMock,
  readTagGain: readTagGainMock,
}))

vi.mock('../Media/Media.js', () => ({
  default: { update: updateMock },
}))

vi.mock('../Prefs/Prefs.js', () => ({
  default: { get: prefsGetMock },
}))

vi.mock('../lib/pushQueuesAndLibrary.js', () => ({
  default: pushMock,
}))

import {
  isGainActive,
  isGainPaused,
  pauseGainScan,
  resumeGainScan,
  startGainScan,
  stopGainScan,
} from './GainScan.js'

const io = () => ({ emit: vi.fn() })

const prefsWithPath = () => ({
  paths: { entities: { 1: { path: '/media' } } },
})

async function waitForIdle (timeoutMs = 5000): Promise<void> {
  const start = Date.now()

  while (isGainActive()) {
    if (Date.now() - start > timeoutMs) throw new Error('gain scan did not finish in time')
    await new Promise(resolve => setTimeout(resolve, 10))
  }
}

function finishedPayload (emitMock) {
  const calls = emitMock.mock.calls.map(call => call[1]?.payload).filter(Boolean)
  const done = calls.filter(payload => payload.isScanning === false)

  return done[done.length - 1]
}

describe('GainScan', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    prefsGetMock.mockReturnValue(prefsWithPath())
    dbGetMock.mockReturnValue({ count: 2 })
    readTagGainMock.mockResolvedValue(null)
  })

  it('measures rows without gain and reports completion', async () => {
    dbAllMock
      .mockReturnValueOnce([
        { mediaId: 1, pathId: 1, relPath: 'a.mp3' },
        { mediaId: 2, pathId: 1, relPath: 'b.mp3' },
      ])
      .mockReturnValue([])
    measureMock.mockResolvedValue({ gainDb: -2.5, peakRatio: 1 })

    const sock = io()
    expect(startGainScan(sock)).toBe(true)
    expect(isGainActive()).toBe(true)
    await waitForIdle()

    expect(updateMock).toHaveBeenCalledTimes(2)
    expect(updateMock).toHaveBeenCalledWith(expect.objectContaining({
      mediaId: 1,
      rgTrackGain: -2.5,
      rgTrackPeak: 1,
    }))
    expect(pushMock).toHaveBeenCalledWith(sock)
    expect(finishedPayload(sock.emit)).toMatchObject({
      isScanning: false,
      pct: 100,
      job: 'gain',
    })
    expect(finishedPayload(sock.emit).text).toContain('Gain scan finished (2 measured, 0 from tags, 0 skipped)')
  })

  it('skips unmeasurable files and unknown paths', async () => {
    dbAllMock
      .mockReturnValueOnce([
        { mediaId: 1, pathId: 1, relPath: 'a.mp3' },
        { mediaId: 2, pathId: 9, relPath: 'b.mp3' },
      ])
      .mockReturnValue([])
    measureMock.mockResolvedValue(null)

    const sock = io()
    startGainScan(sock)
    await waitForIdle()

    expect(updateMock).not.toHaveBeenCalled()
    expect(pushMock).not.toHaveBeenCalled()
    expect(finishedPayload(sock.emit).text).toContain('Gain scan finished (0 measured, 0 from tags, 2 skipped)')
  })

  it('refuses a second concurrent job', async () => {
    let resolveMeasure
    dbAllMock.mockReturnValue([{ mediaId: 1, pathId: 1, relPath: 'a.mp3' }])
    measureMock.mockReturnValue(new Promise((resolve) => {
      resolveMeasure = resolve
    }))

    const sock = io()
    expect(startGainScan(sock)).toBe(true)
    expect(startGainScan(sock)).toBe(false)

    resolveMeasure({ gainDb: -1, peakRatio: 1 })
    dbAllMock.mockReturnValue([])
    await waitForIdle()
  })

  it('pauses between files and resumes afterwards', async () => {
    const resolvers = []
    dbAllMock.mockImplementation(() => [
      { mediaId: 1, pathId: 1, relPath: 'a.mp3' },
      { mediaId: 2, pathId: 1, relPath: 'b.mp3' },
    ])
    measureMock.mockImplementation(() => new Promise((resolve) => {
      resolvers.push(resolve)

      // only two files exist; further batches are empty
      if (resolvers.length >= 2) dbAllMock.mockReturnValue([])
    }))

    const sock = io()
    startGainScan(sock)

    while (resolvers.length < 1) await new Promise(resolve => setTimeout(resolve, 10))
    expect(pauseGainScan()).toBe(true)
    expect(isGainPaused()).toBe(true)

    resolvers[0]({ gainDb: -1, peakRatio: 1 })
    await new Promise(resolve => setTimeout(resolve, 50))
    // second file not started while paused
    expect(resolvers.length).toBe(1)
    expect(updateMock).toHaveBeenCalledTimes(1)

    resumeGainScan()
    expect(isGainPaused()).toBe(false)

    while (resolvers.length < 2) await new Promise(resolve => setTimeout(resolve, 10))
    resolvers[1]({ gainDb: -2, peakRatio: 1 })
    await waitForIdle()

    expect(updateMock).toHaveBeenCalledTimes(2)
    expect(finishedPayload(sock.emit).text).toContain('Gain scan finished (2 measured, 0 from tags, 0 skipped)')
  })

  it('retries files cleared by an interrupting scan on resume', async () => {
    const resolvers = []
    dbAllMock.mockReturnValue([{ mediaId: 1, pathId: 1, relPath: 'a.mp3' }])
    measureMock.mockImplementation(() => new Promise((resolve) => {
      resolvers.push(resolve)
    }))

    const sock = io()
    startGainScan(sock)

    while (resolvers.length < 1) await new Promise(resolve => setTimeout(resolve, 10))
    expect(pauseGainScan()).toBe(true)

    resolvers[0]({ gainDb: -1, peakRatio: 1 })
    while (updateMock.mock.calls.length < 1) await new Promise(resolve => setTimeout(resolve, 10))

    // interrupting library scan clears the just-measured value (upstream
    // scan behaviour for files without tags)
    updateMock.mockClear()

    resumeGainScan()

    while (resolvers.length < 2) await new Promise(resolve => setTimeout(resolve, 10))
    resolvers[1]({ gainDb: -1, peakRatio: 1 })
    await waitForIdle()

    // measured again instead of being skipped as already attempted
    expect(updateMock).toHaveBeenCalledTimes(1)
    expect(finishedPayload(sock.emit).text).toContain('Gain scan finished (2 measured, 0 from tags, 0 skipped)')
  })

  it('uses file tags without measuring', async () => {
    dbAllMock
      .mockReturnValueOnce([
        { mediaId: 1, pathId: 1, relPath: 'a.mp3' },
      ])
      .mockReturnValue([])
    readTagGainMock.mockResolvedValue({ gainDb: -4, peakRatio: 0.9 })

    const sock = io()
    startGainScan(sock)
    await waitForIdle()

    expect(measureMock).not.toHaveBeenCalled()
    expect(updateMock).toHaveBeenCalledWith(expect.objectContaining({
      mediaId: 1,
      rgTrackGain: -4,
      rgTrackPeak: 0.9,
    }))
    expect(finishedPayload(sock.emit).text).toContain('Gain scan finished (0 measured, 1 from tags, 0 skipped)')
  })

  it('reports stop when cancelled', async () => {
    let resolveMeasure
    dbAllMock.mockReturnValue([{ mediaId: 1, pathId: 1, relPath: 'a.mp3' }])
    measureMock.mockReturnValue(new Promise((resolve) => {
      resolveMeasure = resolve
    }))

    const sock = io()
    startGainScan(sock)

    while (measureMock.mock.calls.length < 1) await new Promise(resolve => setTimeout(resolve, 10))
    stopGainScan()
    resolveMeasure({ gainDb: -1, peakRatio: 1 })
    await waitForIdle()

    expect(finishedPayload(sock.emit).text).toContain('Gain scan stopped')
  })
})
