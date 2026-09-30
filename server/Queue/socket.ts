import Queue from './Queue.js'
import Rooms from '../Rooms/Rooms.js'
import { can } from '../lib/permissions.js'
import { QUEUE_ADD, QUEUE_MOVE, QUEUE_REMOVE, QUEUE_PUSH } from '../../shared/actionTypes.js'

// ------------------------------------
// Action Handlers
// ------------------------------------
const ACTION_HANDLERS = {
  [QUEUE_ADD]: async (sock, { payload }, acknowledge) => {
    const { songId } = payload

    try {
      await Rooms.validate(sock.user.roomId, null, { validatePassword: false })
    } catch (err) {
      return acknowledge({
        type: QUEUE_ADD + '_ERROR',
        error: err.message,
      })
    }

    Queue.add({
      roomId: sock.user.roomId,
      songId,
      userId: sock.user.userId,
    })

    // success
    acknowledge({ type: QUEUE_ADD + '_SUCCESS' })

    // to all in room
    sock.server.to(Rooms.prefix(sock.user.roomId)).emit('action', {
      type: QUEUE_PUSH,
      payload: Queue.get(sock.user.roomId),
    })
  },
  [QUEUE_MOVE]: async (sock, { payload }, acknowledge) => {
    const { queueId, prevQueueId } = payload

    if (!Number.isInteger(queueId) || (prevQueueId !== null && !Number.isInteger(prevQueueId))) {
      return acknowledge({
        type: QUEUE_MOVE + '_ERROR',
        error: 'Invalid queueId',
      })
    }

    try {
      await Rooms.validate(sock.user.roomId, null, { validatePassword: false })
    } catch (err) {
      return acknowledge({
        type: QUEUE_MOVE + '_ERROR',
        error: err.message,
      })
    }

    if (!can(sock.user, 'queueMove') && !(Queue.isOwner(sock.user.userId, queueId))) {
      return acknowledge({
        type: QUEUE_MOVE + '_ERROR',
        error: 'Cannot move another user\'s song',
      })
    }

    try {
      Queue.move({
        prevQueueId,
        queueId,
        roomId: sock.user.roomId,
      })
    } catch (err) {
      return acknowledge({
        type: QUEUE_MOVE + '_ERROR',
        error: err.message,
      })
    }

    // success
    acknowledge({ type: QUEUE_MOVE + '_SUCCESS' })

    // tell room
    sock.server.to(Rooms.prefix(sock.user.roomId)).emit('action', {
      type: QUEUE_PUSH,
      payload: Queue.get(sock.user.roomId),
    })
  },
  [QUEUE_REMOVE]: async (sock, { payload }, acknowledge) => {
    const { queueId } = payload
    const ids = Array.isArray(queueId) ? queueId : [queueId]

    if (!ids.length || ids.some(id => !Number.isInteger(id))) {
      return acknowledge({
        type: QUEUE_REMOVE + '_ERROR',
        error: 'Invalid queueId',
      })
    }

    try {
      await Rooms.validate(sock.user.roomId, null, { validatePassword: false })
    } catch (err) {
      return acknowledge({
        type: QUEUE_REMOVE + '_ERROR',
        error: err.message,
      })
    }

    if (!can(sock.user, 'queueDelete') && !(Queue.isOwner(sock.user.userId, ids, sock.user.roomId))) {
      return acknowledge({
        type: QUEUE_REMOVE + '_ERROR',
        error: 'Cannot remove another user\'s song',
      })
    }

    try {
      for (const id of ids) {
        Queue.remove(id, sock.user.roomId)
      }
    } catch (err) {
      return acknowledge({
        type: QUEUE_REMOVE + '_ERROR',
        error: err.message,
      })
    }

    // success
    acknowledge({ type: QUEUE_REMOVE + '_SUCCESS' })

    // tell room
    sock.server.to(Rooms.prefix(sock.user.roomId)).emit('action', {
      type: QUEUE_PUSH,
      payload: Queue.get(sock.user.roomId),
    })
  },
}

export default ACTION_HANDLERS
