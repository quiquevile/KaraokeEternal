import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Provider } from '../../shared/types.js'
import { PROVIDER_FETCH_REQUEST, PROVIDER_SEARCH_REQUEST } from '../../shared/actionTypes.js'

const { getPrefs, search, request } = vi.hoisted(() => ({
  getPrefs: vi.fn(),
  search: vi.fn(async (provider: Provider) => provider),
  request: vi.fn(async () => {}),
}))

vi.mock('../Prefs/Prefs.js', () => ({ default: { get: getPrefs } }))
vi.mock('./Providers.js', () => ({
  default: { search },
  isTypeEnabled: (p: Provider) => p.prefs.enabled && p.prefs.types.song?.enabled === true,
}))
vi.mock('./ProviderFetch.js', () => ({ default: { request, isComplete: vi.fn(() => false) } }))
vi.mock('./ProviderStatus.js', () => ({
  default: { settled: vi.fn(async () => {}), songVersion: vi.fn(() => 0) },
}))

import handlers from './socket.js'

const provider = (providerId: number, visibility: Provider['visibility']): Provider => ({
  providerId,
  name: `P${providerId}`,
  url: `http://p${providerId}`,
  priority: providerId,
  visibility,
  prefs: { enabled: true, types: { song: { enabled: true, maxLibraryResults: null } } },
})

const providers = [provider(1, 'public'), provider(2, 'manager'), provider(3, 'admin')]

const socket = (permissions: Record<string, boolean> = {}, isAdmin = false) => ({
  user: { userId: 1, roomId: 1, isAdmin, permissions },
  emit: vi.fn(),
})

beforeEach(() => {
  vi.clearAllMocks()
  getPrefs.mockReturnValue({ providers: { entities: Object.fromEntries(providers.map(p => [p.providerId, p])) } })
})

describe('provider socket visibility', () => {
  it('checks requested IDs against the caller before searching', async () => {
    const payload = { query: 'song', providerIds: [1, 2, 3] }

    await handlers[PROVIDER_SEARCH_REQUEST](socket(), { payload }, vi.fn())
    expect(search.mock.calls.map(call => (call[0] as Provider).providerId)).toEqual([1])

    search.mockClear()
    await handlers[PROVIDER_SEARCH_REQUEST](socket({ manageProviders: true }), { payload }, vi.fn())
    expect(search.mock.calls.map(call => (call[0] as Provider).providerId)).toEqual([1, 2])

    search.mockClear()
    await handlers[PROVIDER_SEARCH_REQUEST](socket({}, true), { payload }, vi.fn())
    expect(search.mock.calls.map(call => (call[0] as Provider).providerId)).toEqual([1, 2, 3])
  })

  it('rejects a direct fetch request for a hidden provider', async () => {
    const acknowledge = vi.fn()
    const payload = { providerId: 2, itemId: 'a', title: 'Song', artist: 'Singer' }

    await handlers[PROVIDER_FETCH_REQUEST](socket(), { payload }, acknowledge)
    expect(request).not.toHaveBeenCalled()
    expect(acknowledge).toHaveBeenCalledWith(expect.objectContaining({ type: `${PROVIDER_FETCH_REQUEST}_ERROR` }))

    acknowledge.mockClear()
    await handlers[PROVIDER_FETCH_REQUEST](socket({ manageProviders: true }), { payload }, acknowledge)
    expect(request).toHaveBeenCalledOnce()
    expect(acknowledge).toHaveBeenCalledWith(expect.objectContaining({ type: `${PROVIDER_FETCH_REQUEST}_SUCCESS` }))
  })
})
