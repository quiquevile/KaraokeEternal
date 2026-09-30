import type { QueueItem, OptimisticQueueItem } from 'shared/types'

interface QueueView {
  result: number[]
  entities: Record<number, QueueItem | OptimisticQueueItem>
}

/**
 * Finds the queueId after which a moved item should be linked: the user's
 * last-played item at or before the player's current position.
 *
 * The player's current queueId comes from the room's last PLAYER_STATUS,
 * which may be stale (no player open, item since removed) — an anchor
 * outside the visible queue falls back to -1 (head), mirroring a fresh
 * status instead of sending a dangling id the server would reject.
 */
export function getMoveAnchor (queue: QueueView, statusQueueId: number, userId: number): number {
  const anchor = queue.result.includes(statusQueueId) ? statusQueueId : -1
  let lastPlayed = anchor

  for (let i = queue.result.indexOf(anchor); i >= 0; i--) {
    const item = queue.entities[queue.result[i]]
    // optimistic items carry no userId; dangling ids are skipped
    if (item && 'userId' in item && item.userId === userId) {
      lastPlayed = queue.result[i]
      break
    }
  }

  return lastPlayed
}

export default getMoveAnchor
