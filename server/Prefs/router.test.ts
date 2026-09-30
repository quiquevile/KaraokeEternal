import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const {
  getGainStatusMock,
  isGainActiveMock,
  startGainScanMock,
  stopGainScanMock,
} = vi.hoisted(() => ({
  getGainStatusMock: vi.fn(),
  isGainActiveMock: vi.fn(),
  startGainScanMock: vi.fn(),
  stopGainScanMock: vi.fn(),
}))

vi.mock('../Scanner/GainScan.js', () => ({
  getGainStatus: getGainStatusMock,
  isGainActive: isGainActiveMock,
  startGainScan: startGainScanMock,
  stopGainScan: stopGainScanMock,
}))

import {
  handleGainScan,
  handleGainStatus,
  handleSaveEqPreset,
  handleScanAll,
  handleScanPath,
  handleScanStop,
} from './router.js'
import Prefs from './Prefs.js'
import type { RouterContext } from './router.js'

function makeCtx (overrides: Record<string, unknown> = {}): RouterContext {
  return {
    user: { isAdmin: true, userId: 1, username: 'admin' },
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
    io: { emit: vi.fn() },
    startScanner: vi.fn(),
    stopScanner: vi.fn(),
    isScannerActive: vi.fn(() => false),
    ...overrides,
  } as RouterContext
}

describe('gain/scan endpoints', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    isGainActiveMock.mockReturnValue(false)
  })

  it('starts a gain scan for admins when idle', async () => {
    const ctx = makeCtx()
    await handleGainScan(ctx)

    expect(ctx.status).toBe(200)
    expect(startGainScanMock).toHaveBeenCalledWith(ctx.io)
  })

  it('rejects gain scans for non-admins with 401', async () => {
    const ctx = makeCtx({ user: { isAdmin: false, userId: 5, username: 'user' } })

    await expect(handleGainScan(ctx)).rejects.toMatchObject({ status: 401 })
    expect(startGainScanMock).not.toHaveBeenCalled()
  })

  it('rejects gain scans while a library scan runs with 409', async () => {
    const ctx = makeCtx({ isScannerActive: () => true })

    await expect(handleGainScan(ctx)).rejects.toMatchObject({ status: 409 })
    expect(startGainScanMock).not.toHaveBeenCalled()
  })

  it('rejects gain scans while a gain job runs with 409', async () => {
    isGainActiveMock.mockReturnValue(true)
    const ctx = makeCtx()

    await expect(handleGainScan(ctx)).rejects.toMatchObject({ status: 409 })
    expect(startGainScanMock).not.toHaveBeenCalled()
  })

  it('rejects library scans while a gain job runs with 409', async () => {
    isGainActiveMock.mockReturnValue(true)

    await expect(handleScanAll(makeCtx())).rejects.toMatchObject({ status: 409 })
    await expect(handleScanPath(makeCtx({ params: { pathId: '3' } }))).rejects.toMatchObject({ status: 409 })
  })

  it('starts library scans when no gain job runs', async () => {
    const allCtx = makeCtx()
    await handleScanAll(allCtx)
    expect(allCtx.startScanner).toHaveBeenCalledWith(true)

    const pathCtx = makeCtx({ params: { pathId: '3' } })
    await handleScanPath(pathCtx)
    expect(pathCtx.startScanner).toHaveBeenCalledWith(3)
  })

  it('stop cancels both the scanner and the gain job', async () => {
    const ctx = makeCtx()
    await handleScanStop(ctx)

    expect(ctx.stopScanner).toHaveBeenCalled()
    expect(stopGainScanMock).toHaveBeenCalled()
  })

  it('returns the gain job status to admins', async () => {
    const status = { active: true, paused: false, measured: 3, tagged: 0, skipped: 0, total: 10, pct: 30, text: 'Measuring loudness (3/10)' }
    getGainStatusMock.mockReturnValue(status)

    const ctx = makeCtx()
    await handleGainStatus(ctx)

    expect(ctx.body).toEqual(status)
  })

  it('rejects gain status for non-admins with 401', async () => {
    const ctx = makeCtx({ user: { isAdmin: false, userId: 5, username: 'user' } })

    await expect(handleGainStatus(ctx)).rejects.toMatchObject({ status: 401 })
    expect(getGainStatusMock).not.toHaveBeenCalled()
  })
})

describe('handleSaveEqPreset', () => {
  const gains = [1, 0, 0, 0, 0, 0, 0, 0, 0, -1]
  const saver = { isAdmin: false, userId: 5, username: 'op', permissions: { playerControls: true, eqPresetSave: true } }
  const storedPrefs = (eqPresets?: object) => {
    vi.spyOn(Prefs, 'get').mockReturnValue({ ...(eqPresets ? { eqPresets } : {}) } as never)
    return vi.spyOn(Prefs, 'set').mockReturnValue(true)
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('merges one slot over the stored presets', async () => {
    const setSpy = storedPrefs({ P1: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0] })
    const ctx = makeCtx({ user: saver, request: { body: { name: 'P2', gains } } })

    await handleSaveEqPreset(ctx)

    expect(setSpy).toHaveBeenCalledWith('eqPresets', { P1: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0], P2: gains })
    expect(ctx.body).toEqual({ P1: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0], P2: gains })
  })

  it('broadcasts the merged presets to every client', async () => {
    storedPrefs()
    const ctx = makeCtx({ user: saver, request: { body: { name: 'P1', gains } } })

    await handleSaveEqPreset(ctx)

    expect(ctx.io.emit).toHaveBeenCalledWith('action', {
      type: 'prefs/PREFS_PUSH',
      payload: { eqPresets: { P1: gains } },
    })
  })

  it('lets admins save without the permission', async () => {
    const setSpy = storedPrefs()
    const ctx = makeCtx({ request: { body: { name: 'P1', gains } } })

    await handleSaveEqPreset(ctx)

    expect(setSpy).toHaveBeenCalledWith('eqPresets', { P1: gains })
  })

  it('rejects holders of playerControls alone with 401', async () => {
    const setSpy = vi.spyOn(Prefs, 'set').mockReturnValue(true)
    const ctx = makeCtx({
      user: { isAdmin: false, userId: 5, username: 'op', permissions: { playerControls: true } },
      request: { body: { name: 'P1', gains } },
    })

    await expect(handleSaveEqPreset(ctx)).rejects.toMatchObject({ status: 401 })
    expect(setSpy).not.toHaveBeenCalled()
  })

  it('rejects bad slots and gains with 422', async () => {
    const setSpy = storedPrefs()

    const badSlot = makeCtx({ user: saver, request: { body: { name: 'P9', gains } } })
    await expect(handleSaveEqPreset(badSlot)).rejects.toMatchObject({ status: 422 })

    const badGains = makeCtx({ user: saver, request: { body: { name: 'P1', gains: [0, 0] } } })
    await expect(handleSaveEqPreset(badGains)).rejects.toMatchObject({ status: 422 })

    const nanGains = makeCtx({
      user: saver,
      request: { body: { name: 'P1', gains: [0, 0, 0, 0, 0, 0, 0, 0, 0, Number.NaN] } },
    })
    await expect(handleSaveEqPreset(nanGains)).rejects.toMatchObject({ status: 422 })

    expect(setSpy).not.toHaveBeenCalled()
  })
})
