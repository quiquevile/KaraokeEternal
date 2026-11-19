import { describe, expect, it, vi } from 'vitest'
import { PREFS_PUSH } from '../../shared/actionTypes.js'

const { getMock, sanitizeMock } = vi.hoisted(() => ({
  getMock: vi.fn(),
  sanitizeMock: vi.fn(),
}))

vi.mock('./Prefs.js', () => ({
  default: { get: getMock, getSanitizedProviders: sanitizeMock },
}))

import pushPrefs from './pushPrefs.js'

describe('pushPrefs', () => {
  it('sends the global ReplayGain setting to non-admin players', () => {
    const emit = vi.fn()
    getMock.mockReturnValue({
      roles: { result: [], entities: {} },
      isReplayGainEnabled: true,
      playerDisplay: { nextUpLeadMs: 5000 },
      providers: { result: [], entities: {} },
      paths: { result: [], entities: {} },
    })
    sanitizeMock.mockReturnValue({ result: [], entities: {} })

    pushPrefs({
      sockets: { sockets: new Map([['user', { id: 'user', user: { isAdmin: false } }]]) },
      to: vi.fn(() => ({ emit })),
    })

    expect(emit).toHaveBeenCalledWith('action', {
      type: PREFS_PUSH,
      payload: expect.objectContaining({ isReplayGainEnabled: true }),
    })
    expect(emit.mock.calls[0][1].payload).not.toHaveProperty('paths')
  })

  it('sends distinct provider lists to managers and other users', () => {
    const emit = vi.fn()
    const to = vi.fn(() => ({ emit }))
    getMock.mockReturnValue({ providers: { result: [], entities: {} } })
    sanitizeMock.mockImplementation((_providers: unknown, user: { permissions?: Record<string, boolean> }) => ({
      result: user.permissions?.manageProviders ? [1, 2] : [1],
      entities: {},
    }))

    pushPrefs({
      sockets: { sockets: new Map([
        ['manager', { id: 'manager', user: { isAdmin: false, permissions: { manageProviders: true } } }],
        ['standard', { id: 'standard', user: { isAdmin: false, permissions: {} } }],
      ]) },
      to,
    })

    expect(to).toHaveBeenNthCalledWith(1, ['manager'])
    expect(to).toHaveBeenNthCalledWith(2, ['standard'])
    expect(emit.mock.calls.map(call => call[1].payload.providers.result)).toEqual([[1, 2], [1]])
  })
})
