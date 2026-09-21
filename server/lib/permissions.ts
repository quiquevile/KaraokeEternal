// Operators (admins and room admins) control playback and the queue
// in whatever room they're currently connected to.
export const isStaff = (user: { isAdmin: boolean, isRoomAdmin: boolean }): boolean =>
  user.isAdmin || user.isRoomAdmin

export default isStaff
