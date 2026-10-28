import { describe, expect, it } from 'vitest'
import { getMoveAnchor, type QueueView } from './getMoveAnchor'

const chain = {
  result: [10, 20, 30, 40, 50],
  entities: {
    10: { queueId: 10, userId: 1 },
    20: { queueId: 20, userId: 2 },
    30: { queueId: 30, userId: 1 },
    40: { queueId: 40, userId: 1 },
    50: { queueId: 50, userId: 2 },
  },
} as unknown as QueueView

describe('getMoveAnchor', () => {
  it('links before the user\'s first upcoming item', () => {
    // 10 played by user 1, 20 is current: their upcoming is 30, 40
    // moving 40 must land it right before 30 (their next turn)
    expect(getMoveAnchor(chain, [10], 20, 40)).toBe(20)
  })

  it('yields the current predecessor when the item is already first', () => {
    // 30 is user 1's first upcoming: anchor = its chain predecessor, which
    // is what the entity already has, so the server no-ops
    expect(getMoveAnchor(chain, [10], 20, 30)).toBe(20)
  })

  it('keeps the item first when the user\'s older upcoming items are played', () => {
    // 30 played since: 40 becomes first upcoming, its predecessor 30
    expect(getMoveAnchor(chain, [10, 30], 20, 40)).toBe(30)
  })

  it('anchors at head when the first upcoming item opens the chain', () => {
    const headFirst = {
      result: [30, 40, 20],
      entities: {
        20: { queueId: 20, userId: 2 },
        30: { queueId: 30, userId: 1 },
        40: { queueId: 40, userId: 1 },
      },
    } as unknown as QueueView

    // already first → -1 matches a null prevQueueId (server no-op);
    // moved to head otherwise: user 1's order becomes 40, 30
    expect(getMoveAnchor(headFirst, [], 20, 30)).toBe(-1)
    expect(getMoveAnchor(headFirst, [], 20, 40)).toBe(-1)
  })

  it('does not anchor at the current song when the user\'s played songs were removed', () => {
    // repro of the bug: user 1's played songs left the queue, so nothing
    // of theirs precedes 30/40; the current song belongs to user 2.
    // old fallback anchored after 20 → 40 dropped to the bottom of user 1
    const playedRemoved = {
      result: [30, 40, 20],
      entities: {
        20: { queueId: 20, userId: 2 },
        30: { queueId: 30, userId: 1 },
        40: { queueId: 40, userId: 1 },
      },
    } as unknown as QueueView

    // 40 goes to the head, ahead of 30, never after 20
    expect(getMoveAnchor(playedRemoved, [10, 99], 20, 40)).toBe(-1)
    // 30 already opens the chain → -1 (no-op)
    expect(getMoveAnchor(playedRemoved, [10, 99], 20, 30)).toBe(-1)
  })

  it('does not treat the current song as upcoming for its owner', () => {
    const ownCurrent = {
      result: [10, 30, 40, 50],
      entities: {
        10: { queueId: 10, userId: 2 },
        30: { queueId: 30, userId: 1 },
        40: { queueId: 40, userId: 1 },
        50: { queueId: 50, userId: 2 },
      },
    } as unknown as QueueView

    // 30 (user 1) is current: 40 is already their next song → no-op,
    // not a move in front of the current song
    expect(getMoveAnchor(ownCurrent, [], 30, 40)).toBe(30)
  })

  it('ignores a stale status anchor', () => {
    // status points at an id that left the queue (or -1: no player open)
    expect(getMoveAnchor(chain, [10], 871, 40)).toBe(20)
    expect(getMoveAnchor(chain, [10], -1, 40)).toBe(20)
  })

  it('skips optimistic and dangling predecessors', () => {
    const withOptimistic = {
      result: [10, 999, 30, 40],
      entities: {
        ...chain.entities,
        999: { queueId: 999, prevQueueId: 10, songId: 7, isOptimistic: true },
      },
    } as unknown as QueueView

    // predecessor of 30 is the optimistic row 999 the server doesn't know
    expect(getMoveAnchor(withOptimistic, [], 10, 40)).toBe(10)
    // dangling id in result (entity already removed) is skipped as well
    const withDangling = {
      result: [10, 998, 30, 40],
      entities: chain.entities,
    } as unknown as QueueView

    expect(getMoveAnchor(withDangling, [], 10, 40)).toBe(10)
  })

  it('returns -1 when the moved item is not in the chain', () => {
    expect(getMoveAnchor(chain, [10], 20, 41)).toBe(-1)
  })

  it('returns -1 when the moved item belongs to no known user', () => {
    const optimisticMove = {
      result: [10, 30],
      entities: {
        10: { queueId: 10, userId: 1 },
        30: { queueId: 30, prevQueueId: 10, songId: 7, isOptimistic: true },
      },
    } as unknown as QueueView

    expect(getMoveAnchor(optimisticMove, [], -1, 30)).toBe(-1)
  })
})
