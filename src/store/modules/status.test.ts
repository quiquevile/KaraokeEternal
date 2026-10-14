import { describe, expect, it } from 'vitest'
import { PLAYER_LEAVE, PLAYER_STATUS } from 'shared/actionTypes.js'
import statusReducer, { roomSwitched } from './status'

describe('playerStatus', () => {
  it('marks the player present', () => {
    const state = statusReducer(undefined, {
      type: PLAYER_STATUS,
      payload: { isPlaying: true },
    })

    expect(state.isPlayerPresent).toBe(true)
    expect(state.isPlaying).toBe(true)
  })
})

describe('playerLeave', () => {
  it('marks the player gone', () => {
    const present = statusReducer(undefined, {
      type: PLAYER_STATUS,
      payload: {},
    })
    expect(present.isPlayerPresent).toBe(true)

    const gone = statusReducer(present, { type: PLAYER_LEAVE })

    expect(gone.isPlayerPresent).toBe(false)
  })
})

describe('switchRoom', () => {
  it('resets room-scoped player status', () => {
    const dirty = statusReducer(undefined, {
      type: PLAYER_STATUS,
      payload: { isPlaying: true, queueId: 7 },
    })
    expect(dirty.isPlayerPresent).toBe(true)

    const reset = statusReducer(dirty, roomSwitched())
    expect(reset).toEqual(statusReducer(undefined, { type: '@@INIT' } as never))
  })
})
