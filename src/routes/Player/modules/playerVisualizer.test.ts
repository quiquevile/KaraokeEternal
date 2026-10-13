import { describe, it, expect } from 'vitest'
import { configureStore } from '@reduxjs/toolkit'
import reducer, { playerLoad, presetKeys } from './playerVisualizer'
import { PLAYER_CMD_OPTIONS } from 'shared/actionTypes'

const makeStore = (presetKey: string) => configureStore({
  reducer: { playerVisualizer: reducer },
  preloadedState: {
    playerVisualizer: {
      isEnabled: true,
      isSupported: true,
      presetKey,
      presetName: 'preset',
      sensitivity: 1,
    },
  },
})

const requestOptions = (visualizer: object) => ({
  type: PLAYER_CMD_OPTIONS,
  payload: { visualizer },
})

describe('playerVisualizer presets', () => {
  it('covers every pack without the hefty preset data', () => {
    expect(presetKeys.length).toBeGreaterThan(100)
  })

  it('excludes broken presets from the cycle', () => {
    expect(presetKeys).not.toContain('Flexi + Martin - astral projection')
    expect(presetKeys).not.toContain('Rovastar & Loadus + Zylot - FractalDrop (Spark Machine v2.0)')
  })

  it('wraps around at both ends of the cycle', () => {
    const first = presetKeys[0]
    const last = presetKeys[presetKeys.length - 1]
    const nextStore = makeStore(last)
    nextStore.dispatch(requestOptions({ nextPreset: true }))

    expect(nextStore.getState().playerVisualizer.presetKey).toBe(first)

    const prevStore = makeStore(first)
    prevStore.dispatch(requestOptions({ prevPreset: true }))

    expect(prevStore.getState().playerVisualizer.presetKey).toBe(last)
  })

  it('picks a random known preset on load', () => {
    const store = makeStore('bogus')

    store.dispatch(playerLoad())

    expect(presetKeys).toContain(store.getState().playerVisualizer.presetKey)
  })
})
