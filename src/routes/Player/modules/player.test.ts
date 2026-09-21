import { describe, expect, it } from 'vitest'
import { PLAYER_CMD_OPTIONS } from 'shared/actionTypes.js'
import playerReducer from './player'

describe('playerCmdOptions', () => {
  it('stores the requested pitch without changing display options', () => {
    const state = playerReducer(undefined, {
      type: PLAYER_CMD_OPTIONS,
      payload: { pitchSemitones: -2 },
    })

    expect(state.pitchSemitones).toBe(-2)
    expect(state.cdgAlpha).toBe(0.5)
    expect(state.cdgSize).toBe(0.65)
    expect(state.mp4Alpha).toBe(0.5)
  })
})
