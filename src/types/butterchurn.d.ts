declare module 'butterchurn' {
  type Preset = Record<string, unknown>
  type ImageData = { data: string, width: number, height: number }
  class Visualizer {
    loadExtraImages (imageData: Record<string, ImageData>): void
    loadPreset (preset: Preset, blendTime: number): void
    setRendererSize (width: number, height: number): void
    connectAudio (node: AudioNode): void
    render (): void
  }

  export default class Butterchurn {
    static createVisualizer (context: BaseAudioContext, canvas: HTMLCanvasElement, options?: {
      width?: number
      height?: number
      onlyUseWASM?: boolean
    }): Visualizer
  }
}

declare module 'butterchurn-presets/all' {
  import { type Preset } from 'butterchurn'
  const presets: Record<string, Preset>
  export default presets
}

declare module 'butterchurn-presets/presetPackMeta' {
  interface PresetPackKeys {
    presets: string[]
    chunk: string
  }

  export function getBasePresetKeys (): PresetPackKeys
  export function getExtraPresetKeys (): PresetPackKeys
  export function getImagePresetKeys (): PresetPackKeys
  export function getMinimalPresetKeys (): PresetPackKeys
  export function getNonMinimalPresetKeys (): PresetPackKeys
  export function getMD1PresetKeys (): PresetPackKeys
  export function getAllPresetKeys (): PresetPackKeys
}

declare module 'butterchurn-presets/dist/base.min' {
  import { type Preset } from 'butterchurn'
  const presets: Record<string, Preset>
  export default presets
}

declare module 'butterchurn-presets/dist/extra.min' {
  import { type Preset } from 'butterchurn'
  const presets: Record<string, Preset>
  export default presets
}

declare module 'butterchurn-presets/dist/image.min' {
  import { type Preset } from 'butterchurn'
  const presets: Record<string, Preset>
  export default presets
}

declare module 'butterchurn-presets/dist/md1.min' {
  import { type Preset } from 'butterchurn'
  const presets: Record<string, Preset>
  export default presets
}

declare module 'butterchurn-presets/dist/minimal.min' {
  import { type Preset } from 'butterchurn'
  const presets: Record<string, Preset>
  export default presets
}

declare module 'butterchurn-presets/dist/nonMinimal.min' {
  import { type Preset } from 'butterchurn'
  const presets: Record<string, Preset>
  export default presets
}

declare module 'butterchurn-presets/imageData' {
  import { type ImageData } from 'butterchurn'
  const imageData: Record<string, ImageData>
  export default imageData
}
