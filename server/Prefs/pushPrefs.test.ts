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
})
