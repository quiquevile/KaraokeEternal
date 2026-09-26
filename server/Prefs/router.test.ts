import { describe, it, expect, vi, beforeEach } from 'vitest'

const {
  isGainActiveMock,
  startGainScanMock,
  stopGainScanMock,
} = vi.hoisted(() => ({
  isGainActiveMock: vi.fn(),
  startGainScanMock: vi.fn(),
  stopGainScanMock: vi.fn(),
}))

vi.mock('../Scanner/GainScan.js', () => ({
  isGainActive: isGainActiveMock,
  startGainScan: startGainScanMock,
  stopGainScan: stopGainScanMock,
}))

import {
  handleGainScan,
  handleScanAll,
  handleScanPath,
  handleScanStop,
} from './router.js'
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
})
