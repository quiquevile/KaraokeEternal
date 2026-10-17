import Queue from './Queue.js'
import Rooms from '../Rooms/Rooms.js'
import User from '../User/User.js'
import { can } from '../lib/permissions.js'
import { sockLocale, t } from '../lib/locale.js'
import { QUEUE_ADD, QUEUE_MOVE, QUEUE_REMOVE, QUEUE_PUSH } from '../../shared/actionTypes.js'

// ------------------------------------
// Action Handlers
// ------------------------------------
const ACTION_HANDLERS = {
  [QUEUE_ADD]: async (sock, { payload }, acknowledge) => {
    const { songId, queueUserId } = payload
    const targetUserId = queueUserId ?? sock.user.userId

    if (queueUserId !== undefined && queueUserId !== null && queueUserId !== sock.user.userId) {
      if (!Number.isInteger(queueUserId)) {
        return acknowledge({
          type: QUEUE_ADD + '_ERROR',
          error: t(sockLocale(sock), 'server.queue.invalidId', 'Invalid queueUserId'),
        })
      }

      const target = User.getById(queueUserId)

      if (target && target.role === 'ghost') {
        // ghosts are never in a room; only their creator may queue for
        // them (not even other admins)
        if (target.createdBy !== sock.user.userId || !can(sock.user, 'ghostUsers')) {
          return acknowledge({
            type: QUEUE_ADD + '_ERROR',
            error: t(sockLocale(sock), 'server.queue.queueGhost', 'Cannot queue songs for this ghost user'),
          })
        }
      } else {
        if (!can(sock.user, 'queueForOthers')) {
          return acknowledge({
            type: QUEUE_ADD + '_ERROR',
            error: t(sockLocale(sock), 'server.queue.queueOthers', 'Cannot queue songs for another user'),
          })
        }

        if (!target) {
          return acknowledge({
            type: QUEUE_ADD + '_ERROR',
            error: t(sockLocale(sock), 'server.queue.queueUserNotFound', 'queue user not found'),
          })
        }

        if (!Rooms.isUserPresent(sock.server, sock.user.roomId, queueUserId)) {
          return acknowledge({
            type: QUEUE_ADD + '_ERROR',
            error: t(sockLocale(sock), 'server.queue.queueUserNotInRoom', 'queue user is not in the room'),
          })
        }
      }
    }

    try {
      await Rooms.validate(sock.user.roomId, null, { validatePassword: false, locale: sockLocale(sock) })
    } catch (err) {
      return acknowledge({
        type: QUEUE_ADD + '_ERROR',
        error: err.message,
      })
    }

    Queue.add({
      roomId: sock.user.roomId,
      songId,
      userId: targetUserId,
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
        error: t(sockLocale(sock), 'server.queue.invalidId', 'Invalid queueId'),
      })
    }

    try {
      await Rooms.validate(sock.user.roomId, null, { validatePassword: false, locale: sockLocale(sock) })
    } catch (err) {
      return acknowledge({
        type: QUEUE_MOVE + '_ERROR',
        error: err.message,
      })
    }

    if (!can(sock.user, 'queueMove') && !(Queue.isOwner(sock.user.userId, queueId))) {
      return acknowledge({
        type: QUEUE_MOVE + '_ERROR',
        error: t(sockLocale(sock), 'server.queue.moveOthers', 'Cannot move another user\'s song'),
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
        error: t(sockLocale(sock), 'server.queue.invalidId', 'Invalid queueId'),
      })
    }

    try {
      await Rooms.validate(sock.user.roomId, null, { validatePassword: false, locale: sockLocale(sock) })
    } catch (err) {
      return acknowledge({
        type: QUEUE_REMOVE + '_ERROR',
        error: err.message,
      })
    }

    if (!can(sock.user, 'queueDelete') && !(Queue.isOwner(sock.user.userId, ids, sock.user.roomId))) {
      return acknowledge({
        type: QUEUE_REMOVE + '_ERROR',
        error: t(sockLocale(sock), 'server.queue.removeOthers', 'Cannot remove another user\'s song'),
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
