import { describe, it, expect } from 'vitest'

import { isStaff, can } from './permissions.js'

describe('isStaff', () => {
  it('returns true for admin', () => {
    expect(isStaff({ isAdmin: true })).toBe(true)
  })

  it('returns false for non-admin', () => {
    expect(isStaff({ isAdmin: false })).toBe(false)
  })
})

describe('can', () => {
  it('returns true for admin regardless of permissions', () => {
    expect(can({ isAdmin: true, permissions: {} }, 'youtubeDownload')).toBe(true)
    expect(can({ isAdmin: true, permissions: { youtubeDownload: false } }, 'youtubeDownload')).toBe(true)
    expect(can({ isAdmin: true }, 'anything')).toBe(true)
  })

  it('returns true when permission is granted', () => {
    expect(can({ isAdmin: false, permissions: { youtubeDownload: true } }, 'youtubeDownload')).toBe(true)
  })

  it('returns false when permission is explicitly false', () => {
    expect(can({ isAdmin: false, permissions: { youtubeDownload: false } }, 'youtubeDownload')).toBe(false)
  })

  it('returns false when permission is missing', () => {
    expect(can({ isAdmin: false, permissions: {} }, 'youtubeDownload')).toBe(false)
  })

  it('returns false for non-admin without permissions field', () => {
    expect(can({ isAdmin: false }, 'youtubeDownload')).toBe(false)
  })
})
