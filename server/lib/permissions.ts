import type { Permission } from '../../shared/types.js'

export const can = (user: { isAdmin: boolean, permissions?: Record<string, boolean> }, capability: Permission): boolean => {
  if (user.isAdmin) return true
  return user.permissions?.[capability] ?? false
}

/**
 * Normalizes a permissions value from a request body or the database
 * into a plain object. Returns null when it is neither an object nor
 * parseable JSON.
 */
export const parsePermissions = (value: unknown): Record<string, boolean> | null => {
  let perms = value

  if (typeof perms === 'string') {
    try {
      perms = JSON.parse(perms)
    } catch {
      return null
    }
  }

  if (typeof perms === 'object' && perms !== null) {
    return perms as Record<string, boolean>
  }

  return null
}
