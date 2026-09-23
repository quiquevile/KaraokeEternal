import Library from '../Library/Library.js'
import Queue from '../Queue/Queue.js'
import Rooms from '../Rooms/Rooms.js'
import { LIBRARY_PUSH, QUEUE_PUSH } from '../../shared/actionTypes.js'

function pushQueuesAndLibrary (io): void {
  // emit queues first: queue items might reference newly non-existent songs
  pushQueues(io)

  // invalidate cache
  Library.cache.version = null

  io.emit('action', {
    type: LIBRARY_PUSH,
    payload: Library.get(),
  })
}

/**
 * Emits the (potentially) updated queue to each active room
 */
export function pushQueues (io): void {
  for (const { room, roomId } of Rooms.getActive(io)) {
    io.to(room).emit('action', {
      type: QUEUE_PUSH,
      payload: Queue.get(roomId),
    })
  }
}

export default pushQueuesAndLibrary
