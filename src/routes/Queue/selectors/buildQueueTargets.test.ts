import { describe, expect, it } from 'vitest'
import { buildQueueTargets } from './buildQueueTargets'

const users = [
  { userId: 3, username: 'zoe', name: 'Zoe' },
  { userId: 1, username: 'ana', name: 'Ana' },
  { userId: 7, username: 'ghost-7', name: 'Kitchen Ghost', isGhost: true },
  { userId: 2, username: 'ben', name: 'Ben' },
]

describe('buildQueueTargets', () => {
  it('puts the current user first and sorts the rest alphabetically', () => {
    expect(buildQueueTargets(users, 3)).toEqual([
      { value: '3', label: 'Zoe (zoe)' },
      { value: '1', label: 'Ana (ana)' },
      { value: '2', label: 'Ben (ben)' },
      { value: '7', label: 'Kitchen Ghost' },
    ])
  })

  it('sorts alphabetically when the current user is not first by name', () => {
    expect(buildQueueTargets(users, 1)).toEqual([
      { value: '1', label: 'Ana (ana)' },
      { value: '2', label: 'Ben (ben)' },
      { value: '7', label: 'Kitchen Ghost' },
      { value: '3', label: 'Zoe (zoe)' },
    ])
  })

  it('handles a missing current user (logged out mid-session)', () => {
    expect(buildQueueTargets(users, null).map(u => u.value)).toEqual(['1', '2', '7', '3'])
  })

  it('labels ghosts with their visible name only', () => {
    expect(buildQueueTargets(users, null).find(u => u.value === '7')).toEqual({
      value: '7',
      label: 'Kitchen Ghost',
    })
  })
})
