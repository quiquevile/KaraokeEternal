import Rooms from './Rooms.js'
import {
  ROOM_PREFS_PUSH_REQUEST,
  ROOM_PREFS_PUSH,
  _ERROR,
} from '../../shared/actionTypes.js'

const ACTION_HANDLERS = {
  [ROOM_PREFS_PUSH_REQUEST]: async (sock, { payload }, acknowledge) => {
    const { roomId } = payload

    if (!sock.user.isAdmin || !roomId) {
      acknowledge({
        type: ROOM_PREFS_PUSH_REQUEST + _ERROR,
        error: 'Unauthorized',
      })

      return
    }

    // live update for every member of the room (players often run as
    // non-admins and need room prefs too)
    sock.server.to(Rooms.prefix(roomId)).emit('action', {
      type: ROOM_PREFS_PUSH,
      payload,
    })
  },
}

export default ACTION_HANDLERS
