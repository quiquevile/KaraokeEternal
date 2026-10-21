import React from 'react'
import { getPlayableUrl } from 'routes/Player/lib/mediaCache'
import styles from './MP4Player.css'

interface MP4PlayerProps {
  isPlaying: boolean
  mediaId: number
  mediaKey: number
  mediaReplayKey?: number
  width: number
  height: number
  onAudioElement(video: HTMLVideoElement): void
  // media events
  onEnd(): void
  onError(error: string): void
  onLoad(): void
  onPlay(): void
  onStatus(status: { position: number, duration: number }): void
}

class MP4Player extends React.Component<MP4PlayerProps> {
  video = React.createRef<HTMLVideoElement>()

  componentDidMount () {
    this.props.onAudioElement(this.video.current)
    this.updateSources()
  }

  componentDidUpdate (prevProps: MP4PlayerProps) {
    // same queue item, but the underlying file changed (e.g. its media
    // version was deleted): restart with the new file
    if (prevProps.mediaKey !== this.props.mediaKey || prevProps.mediaId !== this.props.mediaId) {
      this.updateSources()
      return
    }

    if (prevProps.mediaReplayKey !== this.props.mediaReplayKey) {
      this.video.current.currentTime = 0
      return
    }

    if (prevProps.isPlaying !== this.props.isPlaying) {
      this.updateIsPlaying()
    }
  }

  render () {
    const { width, height } = this.props

    return (
      <video
        className={styles.video}
        preload='auto'
        width={width}
        height={height}
        onCanPlayThrough={this.updateIsPlaying}
        onEnded={this.props.onEnd}
        onError={this.handleError}
        onLoadStart={this.props.onLoad}
        onPlay={this.handlePlay}
        onTimeUpdate={this.handleTimeUpdate}
        ref={this.video}
      />
    )
  }

  updateSources = async () => {
    const { mediaId } = this.props
    if (!this.video.current) return

    // cached media plays from a blob URL (rides out connection hiccups),
    // misses fall back to streaming the URL directly
    const url = await getPlayableUrl(mediaId, 'video')
    // the item changed while the lookup was in flight?
    if (!this.video.current || this.props.mediaId !== mediaId) return
    this.video.current.src = url
    this.video.current.load()
  }

  updateIsPlaying = () => {
    if (!this.video.current) return

    if (this.props.isPlaying) {
      this.video.current.play()
        .catch(err => this.props.onError(err.message))
    } else {
      this.video.current.pause()
    }
  }

  /*
  * <video> event handlers
  */
  handleError = () => {
    const { message, code } = this.video.current.error
    this.props.onError(`${message} (code ${code})`)
  }

  handlePlay = () => this.props.onPlay()

  handleTimeUpdate = () => {
    if (!this.video.current) return

    this.props.onStatus({
      position: this.video.current.currentTime,
      duration: this.video.current.duration || 0,
    })
  }
}

export default MP4Player
