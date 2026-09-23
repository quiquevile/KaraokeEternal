import { describe, it, expect } from 'vitest'

import { can, parsePermissions } from './permissions.js'

describe('can', () => {
  it('returns true for admin regardless of permissions', () => {
    expect(can({ isAdmin: true, permissions: {} }, 'youtubeDownload')).toBe(true)
    expect(can({ isAdmin: true, permissions: { youtubeDownload: false } }, 'youtubeDownload')).toBe(true)
    expect(can({ isAdmin: true }, 'queueDelete')).toBe(true)
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

describe('parsePermissions', () => {
  it('passes objects through', () => {
    expect(parsePermissions({ queueDelete: true })).toEqual({ queueDelete: true })
  })

  it('parses JSON strings', () => {
    expect(parsePermissions('{"queueDelete":true}')).toEqual({ queueDelete: true })
  })

  it('returns null for invalid JSON and non-objects', () => {
    expect(parsePermissions('{invalid')).toBeNull()
    expect(parsePermissions(null)).toBeNull()
    expect(parsePermissions(undefined)).toBeNull()
    expect(parsePermissions(42)).toBeNull()
  })
})
