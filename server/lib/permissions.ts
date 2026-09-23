// Operators (admins) control playback and the queue
// in whatever room they're currently connected to.
export const isStaff = (user: { isAdmin: boolean }): boolean =>
  user.isAdmin

export const can = (user: { isAdmin: boolean, permissions?: Record<string, boolean> }, capability: string): boolean => {
  if (user.isAdmin) return true
  return user.permissions?.[capability] ?? false
}

export default isStaff
