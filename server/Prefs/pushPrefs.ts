import Prefs from './Prefs.js'
import { can } from '../lib/permissions.js'
import { PREFS_PUSH } from '../../shared/actionTypes.js'
import type { Prefs as PrefsType } from '../../shared/types.js'

// Push full prefs to admins and a visibility-filtered provider subset to others.
function pushPrefs (io): void {
  const adminIds = []
  const managerIds = []
  const publicIds = []

  for (const sock of io.sockets.sockets.values()) {
    if (!sock.user) continue
    if (sock.user.isAdmin) adminIds.push(sock.id)
    else if (can(sock.user, 'manageProviders')) managerIds.push(sock.id)
    else publicIds.push(sock.id)
  }

  const prefs = Prefs.get() as unknown as PrefsType

  if (adminIds.length) {
    io.to(adminIds).emit('action', {
      type: PREFS_PUSH,
      payload: prefs,
    })
  }

  for (const [ids, user] of [
    [managerIds, { isAdmin: false, permissions: { manageProviders: true } }],
    [publicIds, { isAdmin: false }],
  ] as const) {
    if (ids.length) {
      io.to(ids).emit('action', {
        type: PREFS_PUSH,
        payload: {
          roles: prefs.roles,
          isReplayGainEnabled: prefs.isReplayGainEnabled,
          playerDisplay: prefs.playerDisplay,
          providers: Prefs.getSanitizedProviders(prefs.providers, user),
        },
      })
    }
  }
}

export default pushPrefs
