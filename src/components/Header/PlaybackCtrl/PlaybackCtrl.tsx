import React, { useState } from 'react'
import { useAppDispatch, useAppSelector } from 'store/hooks'
import { useLocation } from 'react-router'
import clsx from 'clsx'
import screenfull from 'screenfull'
import { requestOptions, requestPause, requestPlay, requestPlayNext, requestReplay, requestVolume } from 'store/modules/status'
import Button from 'components/Button/Button'
import VolumeSlider from './VolumeSlider/VolumeSlider'
import NoPlayer from './NoPlayer/NoPlayer'
import DisplayCtrl from './DisplayCtrl/DisplayCtrl'
import styles from './PlaybackCtrl.css'
import { PlaybackOptions } from 'shared/types'

const handleFullscreen = () => {
  if (screenfull.isEnabled) {
    const el = document.getElementById('player-fs-container')
    screenfull.request(el)
  }
}

const PlaybackCtrl = () => {
  const [isDisplayCtrlVisible, setDisplayCtrlVisible] = useState(false)
  const location = useLocation()
  const isPlayer = location.pathname.replace(/\/$/, '').endsWith('/player')

  const isAdmin = useAppSelector(state => state.user.isAdmin)
  const { permissions } = useAppSelector(state => state.user)
  const isInRoom = useAppSelector(state => state.user.roomId !== null)
  const status = useAppSelector(state => state.status)

  const dispatch = useAppDispatch()
  const handleOptions = (opts: PlaybackOptions) => dispatch(requestOptions(opts))
  const handlePause = () => dispatch(requestPause())
  const handlePlay = () => dispatch(requestPlay())
  const handlePlayNext = () => dispatch(requestPlayNext())
  const handleReplay = () => {
    if (status.queueId !== -1) {
      dispatch(requestReplay(status.queueId))
    } else {
      dispatch(requestPlay())
    }
  }
  const handleVolume = (val: number) => dispatch(requestVolume(val))

  const toggleDisplayCtrl = () => {
    setDisplayCtrlVisible(!isDisplayCtrlVisible)
  }

  const hasPerm = (perm: string): boolean => isAdmin || (permissions?.[perm] ?? false)

  if (!status.isPlayerPresent) {
    return (isAdmin || hasPerm('playerAccess')) && isInRoom && screenfull.isEnabled ? <NoPlayer /> : null
  }

  return (isAdmin || hasPerm('playerControls')) && isInRoom && screenfull.isEnabled ? (
    <div className={styles.container}>
      <Button
        animateClassName={styles.btnAnimate}
        className={clsx(styles.btn, status.isPlaying ? styles.pause : styles.play)}
        icon={status.isPlaying ? 'PAUSE' : 'PLAY'}
        onClick={status.isPlaying ? handlePause : handlePlay}
        aria-label={status.isPlaying ? 'Pause' : 'Play'}
      />

      <Button
        animateClassName={styles.btnAnimate}
        className={clsx(styles.btn, styles.next)}
        icon='PLAY_NEXT'
        onClick={handlePlayNext}
        aria-label='Play Next'
      />

      {(hasPerm('queueReplay')) && (
        <Button
          animateClassName={styles.btnAnimate}
          className={clsx(styles.btn, styles.next)}
          icon='REPLAY_SMALL'
          onClick={handleReplay}
          aria-label='Replay'
        />
      )}

      <VolumeSlider
        volume={status.volume}
        onVolumeChange={handleVolume}
      />

      <Button
        className={clsx(styles.btn, styles.displayCtrl)}
        icon='TUNE'
        onClick={toggleDisplayCtrl}
        size={48}
        aria-label='Display Options'
      />

      {isPlayer && screenfull.isEnabled && (
        <Button
          className={clsx(styles.btn, styles.fullscreen)}
          icon='FULLSCREEN'
          onClick={handleFullscreen}
          aria-label='Enter Fullscreen'
        />
      )}

      {isDisplayCtrlVisible && (
        <DisplayCtrl
          cdgAlpha={status.cdgAlpha}
          cdgSize={status.cdgSize}
          isPitchAdjustable={hasPerm('playerControls')}
          isPitchSupported={status.pitchSupported}
          isVideoKeyingEnabled={status.isVideoKeyingEnabled}
          isVisualizerEnabled={status.visualizer.isEnabled}
          isWebGLSupported={status.isWebGLSupported}
          mediaType={status.mediaType}
          mp4Alpha={status.mp4Alpha}
          onClose={toggleDisplayCtrl}
          onRequestOptions={handleOptions}
          pitchSemitones={status.pitchSemitones}
          sensitivity={status.visualizer.sensitivity}
          visualizerPresetName={status.visualizer.presetName}
        />
      )}
    </div>
  ) : null;
}

export default PlaybackCtrl
