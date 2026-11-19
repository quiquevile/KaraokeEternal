import { describe, expect, it } from 'vitest'
import type { Provider } from '../../shared/types.js'
import { canUseProvider } from './access.js'

const provider = (visibility: Provider['visibility']): Provider => ({
  providerId: 1,
  name: 'Example',
  url: 'http://example.test',
  priority: 0,
  visibility,
  prefs: { enabled: true, types: { song: { enabled: true, maxLibraryResults: null } } },
})

describe('provider visibility', () => {
  it('allows public providers to everyone', () => {
    expect(canUseProvider({ isAdmin: false }, provider('public'))).toBe(true)
  })

  it('reserves admin providers for administrators', () => {
    expect(canUseProvider({ isAdmin: false, permissions: { manageProviders: true } }, provider('admin'))).toBe(false)
    expect(canUseProvider({ isAdmin: true }, provider('admin'))).toBe(true)
  })

  it('lets provider managers use manager providers', () => {
    expect(canUseProvider({ isAdmin: false }, provider('manager'))).toBe(false)
    expect(canUseProvider({ isAdmin: false, permissions: { manageProviders: true } }, provider('manager'))).toBe(true)
    expect(canUseProvider({ isAdmin: true }, provider('manager'))).toBe(true)
  })
})
