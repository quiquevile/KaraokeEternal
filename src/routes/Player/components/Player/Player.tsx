import React from 'react'
import CDGPlayer from './CDGPlayer/CDGPlayer'
import MP4Player from './MP4Player/MP4Player'
import MP4AlphaPlayer from './MP4Player/MP4AlphaPlayer'
import { clampPitchSemitones, createPitchNode, setPitchNodeSemitones } from '../../lib/pitchShift'
import type { SoundTouchNode } from '@soundtouchjs/audio-worklet'
import { type PlayerState } from '../../modules/player'
import { type PlayerVisualizerState } from '../../modules/playerVisualizer'

const PlayerVisualizer = React.lazy(() => import('./PlayerVisualizer/PlayerVisualizer'))

interface PlayerProps {
  cdgAlpha: number
  cdgSize: number
  isPlaying: boolean
  isVisible: boolean
  isReplayGainEnabled: boolean
  isVideoKeyingEnabled: boolean
  isWebGLSupported: boolean
  mediaId: number
  mediaKey: number
  mediaReplayKey?: number
  mediaType?: string
  mp4Alpha: number
  pitchSemitones: number
  rgTrackGain?: number
  rgTrackPeak?: number
  visualizer: PlayerVisualizerState
  volume: number
  width: number
  height: number
  // media events
  onEnd(): void
  onError(error: string): void
  onLoad(): void
  onPlay(): void
  onStatus(status: Partial<PlayerState>): void
}

interface State {
  visualizerAudioSourceNode: MediaElementAudioSourceNode | null
}

class Player extends React.Component<PlayerProps> {
  audioCtx: AudioContext | null = null
  audioGainNode: GainNode | null = null
  audioSourceNode: MediaElementAudioSourceNode | null = null
  pitchNode: SoundTouchNode | null = null
  pitchRequestId = 0
  lastReportedPitchSupport: boolean | null = null
  isFetching = false // internal

  state: State = {
    visualizerAudioSourceNode: null,
  }

  componentDidMount () {
    if (!this.audioCtx) {
      this.audioCtx = new (window.AudioContext || window.webkitAudioContext)()
      this.audioGainNode = this.audioCtx.createGain()
    }

    this.updateVolume()
    void this.refreshPitchGraph()
  }

  componentWillUnmount () {
    this.audioSourceNode?.disconnect()
    this.pitchNode?.disconnect()
    this.audioGainNode?.disconnect()
  }

  componentDidUpdate (prevProps: PlayerProps) {
    // may have been suspended by browser if no user interaction yet
    if (this.props.isPlaying && !prevProps.isPlaying) {
      this.audioCtx?.resume()
    }

    // prevent applying next song's RG vals prematurely
    if (this.props.mediaKey !== prevProps.mediaKey) {
      this.isFetching = true
    }

    // don't change volume if we know we're changing songs
    if (!this.isFetching && (prevProps.volume !== this.props.volume
      || prevProps.rgTrackGain !== this.props.rgTrackGain
      || prevProps.rgTrackPeak !== this.props.rgTrackPeak
      || prevProps.isReplayGainEnabled !== this.props.isReplayGainEnabled)) {
      this.updateVolume()
    }

    if (prevProps.pitchSemitones !== this.props.pitchSemitones) {
      void this.refreshPitchGraph()
    }
  }

  handleAudioElement = (el: HTMLVideoElement | HTMLAudioElement) => {
    if (!this.audioCtx || (this.audioSourceNode && this.audioSourceNode.mediaElement === el)) {
      return
    }

    this.audioSourceNode?.disconnect()
    this.audioSourceNode = this.audioCtx.createMediaElementSource(el)
    void this.refreshPitchGraph()

    // hand back copy of original audio source
    const sourceNodeCopy = this.audioSourceNode
    this.setState({ visualizerAudioSourceNode: sourceNodeCopy })
  }

  refreshPitchGraph = async () => {
    const requestId = ++this.pitchRequestId
    const { audioCtx, audioGainNode, audioSourceNode } = this
    const pitchSemitones = clampPitchSemitones(this.props.pitchSemitones)

    if (!audioCtx || !audioGainNode || !audioSourceNode) return

    if (pitchSemitones === 0) {
      this.connectAudioGraph(false)
      return
    }

    if (!this.pitchNode) {
      try {
        this.pitchNode = await createPitchNode(audioCtx)
      } catch {
        this.pitchNode = null
      }

      if (requestId !== this.pitchRequestId) return
    }

    if (this.pitchNode) {
      this.reportPitchSupport(true)
      this.connectAudioGraph(true)
    } else {
      this.reportPitchSupport(false)
      this.connectAudioGraph(false)
    }
  }

  reportPitchSupport = (supported: boolean) => {
    if (this.lastReportedPitchSupport === supported) return

    this.lastReportedPitchSupport = supported
    this.props.onStatus({ pitchSupported: supported })
  }

  connectAudioGraph = (usePitch: boolean) => {
    const { audioCtx, audioGainNode, audioSourceNode, pitchNode } = this

    if (!audioCtx || !audioGainNode || !audioSourceNode) return

    audioSourceNode.disconnect()
    pitchNode?.disconnect()
    audioGainNode.disconnect()

    if (usePitch && pitchNode) {
      setPitchNodeSemitones(pitchNode, this.props.pitchSemitones)
      audioSourceNode.connect(pitchNode)
      pitchNode.connect(audioGainNode)
    } else {
      audioSourceNode.connect(audioGainNode)
    }

    audioGainNode.connect(audioCtx.destination)
  }

  handlePlay = () => {
    this.isFetching = false
    this.updateVolume()
    this.props.onPlay()
  }

  updateVolume = () => {
    let vol = this.props.volume
    const { isReplayGainEnabled, rgTrackGain, rgTrackPeak } = this.props

    if (isReplayGainEnabled && typeof rgTrackGain === 'number' && typeof rgTrackPeak === 'number') {
      const gainDb = this.props.rgTrackGain
      const peakDb = 20 * Math.log10(this.props.rgTrackPeak) // linear amplitude factor to dB
      const safeGainDb = (gainDb + peakDb >= 0) ? -0.01 - peakDb : gainDb

      vol = vol * Math.pow(10, safeGainDb / 20) // dB to linear amplitude factor
    }

    if (this.audioCtx && this.audioGainNode) {
      this.audioGainNode.gain.setValueAtTime(vol, this.audioCtx.currentTime)
    }
  }

  render () {
    if (!this.props.isVisible || typeof this.props.mediaId !== 'number') return null

    let PlayerComponent: React.ElementType | undefined

    if (this.props.mediaType === 'cdg') PlayerComponent = CDGPlayer
    else if (this.props.mediaType === 'mp4') PlayerComponent = this.props.isVideoKeyingEnabled ? MP4AlphaPlayer : MP4Player

    if (typeof PlayerComponent === 'undefined') {
      this.props.onError(`No player for mediaType: ${this.props.mediaType}`)
      return null
    }

    const isVisualizerActive = (this.props.mediaType === 'cdg' || this.props.isVideoKeyingEnabled)
      && this.props.isWebGLSupported
      && this.props.visualizer.isEnabled
      && this.state.visualizerAudioSourceNode

    return (
      <>
        <PlayerComponent
          {...this.props}
          onAudioElement={this.handleAudioElement}
          onPlay={this.handlePlay}
        />
        {isVisualizerActive && (
          <PlayerVisualizer
            audioSourceNode={this.state.visualizerAudioSourceNode}
            isPlaying={this.props.isPlaying}
            onError={this.props.onError}
            presetKey={this.props.visualizer.presetKey}
            sensitivity={this.props.visualizer.sensitivity}
            width={this.props.width}
            height={this.props.height}
          />
        )}
      </>
    )
  }
}

export default Player
