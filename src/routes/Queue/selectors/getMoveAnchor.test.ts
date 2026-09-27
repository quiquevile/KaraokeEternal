import { describe, expect, it } from 'vitest'
import { getMoveAnchor } from './getMoveAnchor'

const queue = {
  result: [10, 20, 30, 40],
  entities: {
    10: { queueId: 10, userId: 1 },
    20: { queueId: 20, userId: 2 },
    30: { queueId: 30, userId: 1 },
    40: { queueId: 40, userId: 2 },
  },
} as never

describe('getMoveAnchor', () => {
  it('returns the user\'s last-played item at or before the current one', () => {
    // current is 30, user 1 last played 30 itself
    expect(getMoveAnchor(queue, 30, 1)).toBe(30)
    // current is 40, user 1 last played 30
    expect(getMoveAnchor(queue, 40, 1)).toBe(30)
  })

  it('falls back to the current item when the user has no played items', () => {
    expect(getMoveAnchor(queue, 20, 9)).toBe(20)
  })

  it('falls back to head (-1) when the status anchor left the queue', () => {
    // removed/played long ago while no player was open
    expect(getMoveAnchor(queue, 871, 1)).toBe(-1)
    expect(getMoveAnchor(queue, -1, 1)).toBe(-1)
  })
})
