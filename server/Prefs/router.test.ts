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

vi.mock('../User/User.js', () => ({
  default: {
    getEqPresets: vi.fn(),
    setEqPreset: vi.fn(),
  },
}))

import {
  handleGainScan,
  handleGainStatus,
  handleGetEqPresets,
  handleSaveEqPreset,
  handleScanAll,
  handleScanPath,
  handleScanStop,
} from './router.js'
import Prefs from './Prefs.js'
import User from '../User/User.js'
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

describe('handleGetEqPresets', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns the caller’s own slots', async () => {
    vi.mocked(User.getEqPresets).mockReturnValue({ P1: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0] })
    const ctx = makeCtx({ user: { isAdmin: false, userId: 5, username: 'op' } })

    await handleGetEqPresets(ctx)

    expect(User.getEqPresets).toHaveBeenCalledWith(5)
    expect(ctx.body).toEqual({ P1: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0] })
  })

  it('rejects anonymous users with 401', async () => {
    const ctx = makeCtx({ user: { isAdmin: false, userId: null } })

    await expect(handleGetEqPresets(ctx)).rejects.toMatchObject({ status: 401 })
    expect(User.getEqPresets).not.toHaveBeenCalled()
  })
})

describe('handleSaveEqPreset', () => {
  const gains = [1, 0, 0, 0, 0, 0, 0, 0, 0, -1]
  const saver = { isAdmin: false, userId: 5, username: 'op', permissions: { playerControls: true } }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('saves into the caller’s own slots', async () => {
    vi.mocked(User.setEqPreset).mockReturnValue({ P2: gains })
    const ctx = makeCtx({ user: saver, request: { body: { name: 'P2', gains } } })

    await handleSaveEqPreset(ctx)

    expect(User.setEqPreset).toHaveBeenCalledWith(5, 'P2', gains)
    expect(ctx.body).toEqual({ P2: gains })
  })

  it('lets admins save without playback permissions', async () => {
    vi.mocked(User.setEqPreset).mockReturnValue({ P1: gains })
    const ctx = makeCtx({ request: { body: { name: 'P1', gains } } })

    await handleSaveEqPreset(ctx)

    expect(User.setEqPreset).toHaveBeenCalledWith(1, 'P1', gains)
  })

  it('rejects users without playback controls with 401', async () => {
    const ctx = makeCtx({
      user: { isAdmin: false, userId: 5, username: 'op', permissions: { playerAccess: true } },
      request: { body: { name: 'P1', gains } },
    })

    await expect(handleSaveEqPreset(ctx)).rejects.toMatchObject({ status: 401 })
    expect(User.setEqPreset).not.toHaveBeenCalled()
  })

  it('rejects anonymous users with 401', async () => {
    const ctx = makeCtx({
      user: { isAdmin: false, userId: null },
      request: { body: { name: 'P1', gains } },
    })

    await expect(handleSaveEqPreset(ctx)).rejects.toMatchObject({ status: 401 })
    expect(User.setEqPreset).not.toHaveBeenCalled()
  })

  it('maps model errors to their status', async () => {
    const { ValidationError } = await import('../lib/Errors.js')
    vi.mocked(User.setEqPreset).mockImplementation(() => {
      throw new ValidationError('Invalid preset gains')
    })
    const ctx = makeCtx({ user: saver, request: { body: { name: 'P1', gains: [0, 0] } } })

    await expect(handleSaveEqPreset(ctx)).rejects.toMatchObject({ status: 422 })
  })
})
