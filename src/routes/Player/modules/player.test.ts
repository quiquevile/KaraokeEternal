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

  it('enables ReplayGain by default and toggles it per player', () => {
    const initial = playerReducer(undefined, { type: '@@INIT' } as never)
    expect(initial.isReplayGainEnabled).toBe(true)

    const off = playerReducer(initial, {
      type: PLAYER_CMD_OPTIONS,
      payload: { isReplayGainEnabled: false },
    })
    expect(off.isReplayGainEnabled).toBe(false)
    expect(off.pitchSemitones).toBe(initial.pitchSemitones)

    const on = playerReducer(off, {
      type: PLAYER_CMD_OPTIONS,
      payload: { isReplayGainEnabled: true },
    })
    expect(on.isReplayGainEnabled).toBe(true)
  })
})
