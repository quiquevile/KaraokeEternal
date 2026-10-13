import { createAction, createReducer } from '@reduxjs/toolkit'
import {
  getBasePresetKeys,
  getExtraPresetKeys,
  getImagePresetKeys,
  getMD1PresetKeys,
  getMinimalPresetKeys,
  getNonMinimalPresetKeys,
} from 'butterchurn-presets/presetPackMeta'
import {
  PLAYER_CMD_OPTIONS,
  PLAYER_LOAD,
  PLAYER_VISUALIZER_ERROR,
} from 'shared/actionTypes'
import { PlaybackOptions } from 'shared/types'

const BAD_PRESETS = [
  'Flexi + Martin - astral projection',
  'Rovastar & Loadus + Zylot - FractalDrop (Spark Machine v2.0)',
]

// preset key -> data chunk, mirroring the pack merge order of
// `butterchurn-presets/all` (last pack wins on duplicates): the store
// only ever handles key strings, so the 3 MB of preset data never
// enters this bundle and loads on demand in PlayerVisualizer instead
const _presetChunk = new Map<string, string>()

for (const getKeys of [
  getBasePresetKeys,
  getExtraPresetKeys,
  getImagePresetKeys,
  getMD1PresetKeys,
  getMinimalPresetKeys,
  getNonMinimalPresetKeys,
]) {
  const { presets, chunk } = getKeys()

  for (const key of presets) {
    _presetChunk.set(key, chunk)
  }
}

// key order matches the merged pack (Map keeps first-insertion order,
// last value wins — same as the object spread it replaces)
const _presetKeys = [..._presetChunk.keys()].filter(key => !BAD_PRESETS.includes(key))

export const presetKeys: readonly string[] = _presetKeys

export const IMAGE_PRESET_CHUNK = 'butterchurn-presets/dist/image.min'

export const presetChunkOf = (presetKey: string): string | null => (
  _presetChunk.get(presetKey) ?? null
)

const getPreset = (i: number) => ({
  presetKey: _presetKeys[i],
  presetName: `[${i + 1}/${_presetKeys.length}] ` + _presetKeys[i],
})

const getRandomPreset = () => getPreset(Math.floor(Math.random() * (_presetKeys.length - 1)))

// ------------------------------------
// Actions
// ------------------------------------
const playerCmdOptions = createAction<{ visualizer: PlaybackOptions['visualizer'] }>(PLAYER_CMD_OPTIONS)
export const playerLoad = createAction(PLAYER_LOAD)
export const playerVisualizerError = createAction<string>(PLAYER_VISUALIZER_ERROR)

// ------------------------------------
// Reducer
// ------------------------------------
export interface PlayerVisualizerState {
  isEnabled: boolean
  isSupported: boolean
  presetKey: string
  presetName: string
  sensitivity: number
}

const initialState: PlayerVisualizerState = {
  isEnabled: true,
  isSupported: true,
  ...getRandomPreset(),
  sensitivity: 1,
}

const playerVisualizerReducer = createReducer(initialState, (builder) => {
  builder
    .addCase(playerLoad, state => ({
      ...state,
      ...getRandomPreset(),
    }))
    .addCase(playerCmdOptions, (state, { payload }) => {
      const { visualizer } = payload
      if (typeof visualizer !== 'object') return state

      let preset = {}

      if (visualizer.nextPreset || visualizer.prevPreset) {
        const curIdx = _presetKeys.indexOf(state.presetKey)
        const nextIdx = curIdx === _presetKeys.length - 1 ? 0 : curIdx + 1 // wrap around
        const prevIdx = curIdx === 0 ? _presetKeys.length - 1 : curIdx - 1 // wrap around

        preset = getPreset(visualizer.nextPreset ? nextIdx : visualizer.prevPreset ? prevIdx : curIdx)
      } else if (visualizer.randomPreset) {
        preset = getRandomPreset()
      }

      return {
        ...state,
        ...preset,
        isEnabled: typeof visualizer.isEnabled === 'boolean' ? visualizer.isEnabled : state.isEnabled,
        sensitivity: typeof visualizer.sensitivity === 'number' ? visualizer.sensitivity : state.sensitivity,
      }
    })
    .addCase(playerVisualizerError, (state) => {
      state.isSupported = false
    })
})

export default playerVisualizerReducer

declare module 'store/reducers' {
  export interface LazyLoadedSlices {
    playerVisualizer: typeof initialState
  }
}
