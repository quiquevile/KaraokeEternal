import { describe, it, expect } from 'vitest'
import { isStaff } from './permissions.js'

describe('isStaff', () => {
  it('returns true for admins', () => {
    expect(isStaff({ isAdmin: true, isRoomAdmin: false })).toBe(true)
  })

  it('returns true for room admins', () => {
    expect(isStaff({ isAdmin: false, isRoomAdmin: true })).toBe(true)
  })

  it('returns true when both are set', () => {
    expect(isStaff({ isAdmin: true, isRoomAdmin: true })).toBe(true)
  })

  it('returns false for standard users', () => {
    expect(isStaff({ isAdmin: false, isRoomAdmin: false })).toBe(false)
  })

  it('returns false for guests', () => {
    expect(isStaff({ isAdmin: false, isRoomAdmin: false })).toBe(false)
  })
})
