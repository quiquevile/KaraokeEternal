import React from 'react'
import butterchurn, { type Visualizer } from 'butterchurn'
import { IMAGE_PRESET_CHUNK, presetChunkOf } from '../../../modules/playerVisualizer'
import styles from './PlayerVisualizer.css'

type PresetData = Record<string, Record<string, unknown>>
type ImageDataMap = Record<string, { data: string, width: number, height: number }>

// one async chunk per preset pack, loaded on demand and cached:
// sessions that never show the visualizer (e.g. MP4-only) download none
const CHUNK_LOADERS: Record<string, () => Promise<{ default: PresetData }>> = {
  'butterchurn-presets/dist/base.min': () => import(
    /* webpackChunkName: 'viz-presets-base' */
    'butterchurn-presets/dist/base.min',
  ),
  'butterchurn-presets/dist/extra.min': () => import(
    /* webpackChunkName: 'viz-presets-extra' */
    'butterchurn-presets/dist/extra.min',
  ),
  'butterchurn-presets/dist/image.min': () => import(
    /* webpackChunkName: 'viz-presets-image' */
    'butterchurn-presets/dist/image.min',
  ),
  'butterchurn-presets/dist/md1.min': () => import(
    /* webpackChunkName: 'viz-presets-md1' */
    'butterchurn-presets/dist/md1.min',
  ),
  'butterchurn-presets/dist/minimal.min': () => import(
    /* webpackChunkName: 'viz-presets-minimal' */
    'butterchurn-presets/dist/minimal.min',
  ),
  'butterchurn-presets/dist/nonMinimal.min': () => import(
    /* webpackChunkName: 'viz-presets-nonMinimal' */
    'butterchurn-presets/dist/nonMinimal.min',
  ),
}

const chunkCache = new Map<string, PresetData>()
let imageDataCache: ImageDataMap | null = null

const loadPresetChunk = async (chunk: string): Promise<PresetData> => {
  const cached = chunkCache.get(chunk)

  if (cached) return cached

  const loader = CHUNK_LOADERS[chunk]

  if (!loader) throw new Error(`unknown visualizer preset chunk: ${chunk}`)

  const data = (await loader()).default
  chunkCache.set(chunk, data)

  return data
}

const loadImageData = async (): Promise<ImageDataMap> => {
  if (!imageDataCache) {
    imageDataCache = (await import('butterchurn-presets/imageData')).default
  }

  return imageDataCache
}

interface PlayerVisualizerProps {
  audioSourceNode: MediaElementAudioSourceNode
  isPlaying: boolean
  onError(error: string): void
  presetKey: string
  sensitivity: number
  width: number
  height: number
}

class PlayerVisualizer extends React.Component<PlayerVisualizerProps> {
  audioGainNode: GainNode | null = null
  canvas = React.createRef<HTMLCanvasElement>()
  frameId: number | null = null
  visualizer: Visualizer | null = null
  isMounted = false
  extraImagesApplied = false

  componentDidMount () {
    try {
      this.visualizer = butterchurn.createVisualizer(this.props.audioSourceNode.context, this.canvas.current, {
        width: this.props.width,
        height: this.props.height,
      })
    } catch (err) {
      this.props.onError(err.message) // @todo pass error object instead of msg only
      return
    }

    // @todo
    // this.visualizer.setOutputAA(true)

    this.isMounted = true
    void this.ensurePreset(this.props.presetKey, 0.0) // 2nd arg is # of seconds to blend presets

    this.updateAudioSource()
    this.updatePlaying()
  }

  componentDidUpdate (prevProps: PlayerVisualizerProps) {
    const { props } = this

    if (props.audioSourceNode !== prevProps.audioSourceNode) {
      this.updateAudioSource()
    }

    if (props.isPlaying !== prevProps.isPlaying) {
      this.updatePlaying()
    }

    if (props.width !== prevProps.width || props.height !== prevProps.height) {
      this.visualizer.setRendererSize(props.width, props.height)
    }

    if (props.presetKey !== prevProps.presetKey) {
      void this.ensurePreset(props.presetKey, 1) // 2nd arg is # of seconds to blend presets
    }

    if (this.audioGainNode && props.sensitivity !== prevProps.sensitivity) {
      this.audioGainNode.gain.setValueAtTime(props.sensitivity, this.audioGainNode.context.currentTime)
    }
  }

  componentWillUnmount () {
    this.isMounted = false
    cancelAnimationFrame(this.frameId)
    this.frameId = null
  }

  // loads the preset's data chunk on demand (cached per pack): a failed
  // download only leaves the canvas black — it must never error the player
  ensurePreset = async (presetKey: string, blendTime: number) => {
    const chunk = presetChunkOf(presetKey)

    if (!chunk || !this.visualizer) return

    let presets: PresetData

    try {
      presets = await loadPresetChunk(chunk)

      if (chunk === IMAGE_PRESET_CHUNK && !this.extraImagesApplied) {
        const imageData = await loadImageData()

        if (this.isMounted && this.visualizer) {
          this.visualizer.loadExtraImages(imageData)
          this.extraImagesApplied = true
        }
      }
    } catch (err) {
      console.error('[visualizer] preset data failed to load', err)
      return
    }

    if (!this.isMounted || !this.visualizer || this.props.presetKey !== presetKey) return

    const preset = presets[presetKey]

    if (preset) this.visualizer.loadPreset(preset, blendTime)
  }

  render () {
    const { width, height } = this.props

    return (
      <div style={{ width, height }} className={styles.container}>
        <canvas
          width={width}
          height={height}
          ref={this.canvas}
        />
      </div>
    )
  }

  updateAudioSource = () => {
    this.audioGainNode = this.props.audioSourceNode.context.createGain()
    this.props.audioSourceNode.connect(this.audioGainNode)
    this.visualizer.connectAudio(this.audioGainNode)
  }

  updatePlaying = () => {
    if (this.props.isPlaying && !this.frameId) {
      this.renderVisualizerFrame()
    } else {
      cancelAnimationFrame(this.frameId)
      this.frameId = null
    }
  }

  renderVisualizerFrame = () => {
    this.frameId = requestAnimationFrame(this.renderVisualizerFrame)
    this.visualizer.render()
  }
}

export default PlayerVisualizer
