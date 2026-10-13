import React, { useState } from 'react'
import { useIntl } from 'react-intl'
import { useAppDispatch } from 'store/hooks'
import { requestPlay } from 'store/modules/status'
import ColorCycle from './ColorCycle/ColorCycle'
import UpNow from './UpNow/UpNow'
import NextUp from './NextUp/NextUp'
import Icon from 'components/Icon/Icon'
import type { QueueItem } from 'shared/types'
import styles from './PlayerTextOverlay.css'

interface PlayerTextOverlayProps {
  queueItem?: QueueItem
  nextQueueItem?: QueueItem
  isAtQueueEnd: boolean
  isQueueEmpty: boolean
  isErrored: boolean
  width: number
  height: number
  upNowDurationMs: number
  isNextUpVisible: boolean
  nextUpBlinkMs: number
}

const PlayerTextOverlay = ({
  isQueueEmpty,
  isAtQueueEnd,
  isErrored,
  nextQueueItem,
  queueItem,
  width,
  height,
  upNowDurationMs,
  isNextUpVisible,
  nextUpBlinkMs,
}: PlayerTextOverlayProps) => {
  const dispatch = useAppDispatch()
  const intl = useIntl()
  const handlePlay = () => dispatch(requestPlay())
  const [errorOffset] = useState(() => Math.random() * -300)

  let Component

  if (isQueueEmpty || (isAtQueueEnd && !nextQueueItem)) {
    Component = (
      <ColorCycle
        text={intl.formatMessage({ id: 'player.overlay.moreSongs', defaultMessage: 'CAN HAZ MOAR SONGZ?' })}
        className={styles.backdrop}
      />
    )
  } else if (!queueItem || (isAtQueueEnd && nextQueueItem)) {
    Component = (
      <>
        <svg width='0' height='0' style={{ position: 'absolute' }}>
          <defs>
            <linearGradient id='play-icon-gradient' x1='0%' y1='0%' x2='100%' y2='100%'>
              <stop offset='0%' className={styles.gradientStop1} />
              <stop offset='100%' className={styles.gradientStop2} />
            </linearGradient>
          </defs>
        </svg>
        <button
          className={styles.playButton}
          onClick={handlePlay}
          aria-label={intl.formatMessage({ id: 'player.overlay.play', defaultMessage: 'Play' })}
        >
          <Icon icon='PLAY' />
        </button>
      </>
    )
  } else if (isErrored) {
    Component = (
      <>
        <ColorCycle
          text={intl.formatMessage({ id: 'player.overlay.oops', defaultMessage: 'OOPS...' })}
          offset={errorOffset}
          className={styles.backdrop}
        />
        <ColorCycle
          text={intl.formatMessage({ id: 'player.overlay.seeQueue', defaultMessage: 'SEE QUEUE FOR DETAILS' })}
          offset={errorOffset}
          className={styles.backdrop}
        />
      </>
    )
  } else {
    Component = <UpNow queueItem={queueItem} displayMs={upNowDurationMs} />
  }

  return (
    <div style={{ width, height }} className={styles.container}>
      {Component}
      {Component && isNextUpVisible && nextQueueItem && (
        <NextUp
          key={`${nextQueueItem.queueId}`}
          displayName={nextQueueItem.userDisplayName}
          blinkMs={nextUpBlinkMs}
        />
      )}
    </div>
  )
}

export default PlayerTextOverlay
