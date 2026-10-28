import type { QueueItem, OptimisticQueueItem } from 'shared/types'

export interface QueueView {
  result: number[]
  entities: Record<number, QueueItem | OptimisticQueueItem>
}

/**
 * Finds the queueId after which a moved item should be linked so it
 * becomes the user's first upcoming song in the raw chain (the screen
 * interleaves users round-robin, but each user's own order follows the
 * chain — the anchor must be computed there, not on the display view).
 *
 * The anchor is the chain predecessor of the user's first upcoming item:
 * - the moved item is already first → its current predecessor (the
 *   server detects the match and no-ops)
 * - head of chain (or nothing found) → -1
 *
 * Upcoming = not in the player's history and not the current song, so a
 * stale status anchor or removed played songs can't shift the result.
 * Optimistic rows (fake ids the server doesn't know) and dangling ids
 * are skipped, as is the moved item itself.
 */
export function getMoveAnchor (
  queue: QueueView,
  history: number[],
  statusQueueId: number,
  movedQueueId: number,
): number {
  const moved = queue.entities[movedQueueId]
  if (!moved || !('userId' in moved)) return -1

  const isUpcoming = (queueId: number): boolean => {
    const item = queue.entities[queueId]
    // optimistic rows have no userId and are excluded by the narrowing
    if (!item || !('userId' in item)) return false
    if (item.userId !== moved.userId) return false
    return queueId !== statusQueueId && !history.includes(queueId)
  }

  let first = -1
  for (const queueId of queue.result) {
    if (isUpcoming(queueId)) {
      first = queueId
      break
    }
  }
  if (first === -1) return -1

  // link right before the user's first upcoming item: the nearest
  // predecessor the server knows (and never the moved item itself,
  // which would be rejected as an invalid prevQueueId)
  const firstIdx = queue.result.indexOf(first)
  for (let i = firstIdx - 1; i >= 0; i--) {
    const id = queue.result[i]
    const item = queue.entities[id]
    if (id !== movedQueueId && item && item.isOptimistic !== true) return id
  }

  return -1
}

export default getMoveAnchor
