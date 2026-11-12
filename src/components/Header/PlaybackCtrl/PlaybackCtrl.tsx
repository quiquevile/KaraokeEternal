import React, { useState } from 'react'
import { useIntl } from 'react-intl'
import { createAction } from '@reduxjs/toolkit'
import { ensureState } from 'redux-optimistic-ui'
import { useAppDispatch, useAppSelector } from 'store/hooks'
import { useLocation } from 'react-router'
import clsx from 'clsx'
import screenfull from 'screenfull'
import { requestOptions, requestPause, requestPlay, requestPlayNext, requestReplay, requestVolume } from 'store/modules/status'
import { hasPermission } from 'store/modules/user'
import Button from 'components/Button/Button'
import VolumeSlider from './VolumeSlider/VolumeSlider'
import NoPlayer from './NoPlayer/NoPlayer'
import PlayerOptions from './PlayerOptions/PlayerOptions'
import usePlaybackShortcuts from './usePlaybackShortcuts'
import styles from './PlaybackCtrl.css'
import { MEDIA_PITCH_SET, MEDIA_USER_PITCH_SET } from 'shared/actionTypes'
import { PlaybackOptions } from 'shared/types'
import { commonMessages } from '../../../lib/messages'
import { headerMessages } from '../messages'

const setMediaPitch = createAction<{ mediaId: number, pitch: number }>(MEDIA_PITCH_SET)
const setUserPitch = createAction<{ mediaId: number, pitch: number | null }>(MEDIA_USER_PITCH_SET)

const handleFullscreen = () => {
  if (screenfull.isEnabled) {
    const el = document.getElementById('player-fs-container')
    screenfull.request(el)
  }
}

const PlaybackCtrl = () => {
  const [playerOptionsVisible, setPlayerOptionsVisible] = useState(false)
  const location = useLocation()
  const isPlayer = location.pathname.replace(/\/$/, '').endsWith('/player')

  const user = useAppSelector(state => state.user)
  const isGuest = useAppSelector(state => state.user.isGuest)
  const userId = useAppSelector(state => state.user.userId)
  const isInRoom = useAppSelector(state => state.user.roomId !== null)
  const status = useAppSelector(state => state.status)
  const intl = useIntl()

  usePlaybackShortcuts()

  // the media being played, for saving global/user pitches
  const curMedia = useAppSelector((state) => {
    if (state.status.isAtQueueEnd) return null

    const item = ensureState(state.queue).entities[state.status.queueId]
    return item && item.isOptimistic !== true ? item : null
  })

  // a preference is the singer's own, so it's only offered to them
  const canSetUserPitch = !!curMedia && !isGuest && curMedia.userId === userId

  const dispatch = useAppDispatch()
  const handleOptions = (opts: PlaybackOptions) => dispatch(requestOptions(opts))
  const handleSetGlobalPitch = (pitch: number) => dispatch(setMediaPitch({ mediaId: curMedia.mediaId, pitch }))
  const handleSetUserPitch = (pitch: number | null) => dispatch(setUserPitch({ mediaId: curMedia.mediaId, pitch }))
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

  const togglePlayerOptions = () => {
    setPlayerOptionsVisible(!playerOptionsVisible)
  }

  if (!status.isPlayerPresent) {
    return hasPermission(user, 'playerAccess') && isInRoom && screenfull.isEnabled
      ? <NoPlayer />
      : null
  }

  return hasPermission(user, 'playerControls') && isInRoom && screenfull.isEnabled
    ? (
        <div className={styles.container}>
          <Button
            animateClassName={styles.btnAnimate}
            className={clsx(styles.btn, status.isPlaying ? styles.pause : styles.play)}
            icon={status.isPlaying ? 'PAUSE' : 'PLAY'}
            onClick={status.isPlaying ? handlePause : handlePlay}
            aria-label={status.isPlaying
              ? intl.formatMessage(headerMessages.pause)
              : intl.formatMessage(commonMessages.play)}
          />

          <Button
            animateClassName={styles.btnAnimate}
            className={clsx(styles.btn, styles.next)}
            icon='PLAY_NEXT'
            onClick={handlePlayNext}
            aria-label={intl.formatMessage(headerMessages.playNext)}
          />

          {(hasPermission(user, 'queueReplay')) && (
            <Button
              animateClassName={styles.btnAnimate}
              className={clsx(styles.btn, styles.next)}
              icon='REPLAY_SMALL'
              onClick={handleReplay}
              aria-label={intl.formatMessage(headerMessages.replay)}
            />
          )}

          <VolumeSlider
            volume={status.volume}
            onVolumeChange={handleVolume}
          />

          <Button
            className={clsx(styles.btn, styles.playerOptions)}
            icon='TUNE'
            onClick={togglePlayerOptions}
            size={48}
            aria-label={intl.formatMessage(commonMessages.playerOptions)}
          />

          {isPlayer && screenfull.isEnabled && (
            <Button
              className={clsx(styles.btn, styles.fullscreen)}
              icon='FULLSCREEN'
              onClick={handleFullscreen}
              aria-label={intl.formatMessage(headerMessages.fullscreen)}
            />
          )}

          {playerOptionsVisible && (
            <PlayerOptions
              cdgAlpha={status.cdgAlpha}
              cdgSize={status.cdgSize}
              eqEnabled={status.eqEnabled}
              eqGains={status.eqGains}
              eqPreset={status.eqPreset}
              globalPitch={curMedia?.pitch ?? 0}
              isPitchSupported={status.isPitchSupported}
              isReplayGainEnabled={status.isReplayGainEnabled}
              isVideoKeyingEnabled={status.isVideoKeyingEnabled}
              isVisualizerEnabled={status.visualizer.isEnabled}
              isWebGLSupported={status.isWebGLSupported}
              mediaType={status.mediaType}
              mp4Alpha={status.mp4Alpha}
              onClose={togglePlayerOptions}
              onRequestOptions={handleOptions}
              onSetGlobalPitch={hasPermission(user, 'setSongPitch') && curMedia ? handleSetGlobalPitch : undefined}
              onSetUserPitch={canSetUserPitch ? handleSetUserPitch : undefined}
              pitch={status.pitch}
              sensitivity={status.visualizer.sensitivity}
              userPitch={curMedia?.userPitch ?? null}
              visualizerPresetName={status.visualizer.presetName}
            />
          )}
        </div>
      )
    : null
}

export default PlaybackCtrl
