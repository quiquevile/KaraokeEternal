import React, { useState, useEffect, useRef } from 'react'
import { CSSTransition } from 'react-transition-group'
import styles from './VolumeToast.css'

interface VolumeToastProps {
  volume: number
  displayMs: number
  // song (re)start signals: replay of the same song only bumps replayKey,
  // while queueId/mediaId cover advancing to (or restarting) another song
  replayKey: number
  queueId: number
  mediaId: number | null
}

// transient toast mirroring PitchToast on the right edge: shows the current
// volume for a moment on every change (gesture, keyboard or slider) and on
// song start (when non-default; mount is silent)
const VolumeToast = ({ volume, displayMs, replayKey, queueId, mediaId }: VolumeToastProps) => {
  const [show, setShow] = useState(false)
  const [text, setText] = useState('')
  const nodeRef = useRef<HTMLDivElement | null>(null)
  const [prev, setPrev] = useState({ volume, replayKey, queueId, mediaId })

  // react to prop changes during render (previous-props comparison), so
  // showing the toast never has to trigger a cascading effect render
  const volumeChanged = prev.volume !== volume
  const startChanged = prev.replayKey !== replayKey
    || prev.queueId !== queueId
    || prev.mediaId !== mediaId

  if (volumeChanged || (startChanged && volume !== 1)) {
    setPrev({ volume, replayKey, queueId, mediaId })
    setText(`${Math.round(volume * 100)}%`)
    setShow(true)
  }

  // hide again after displayMs; only ever scheduled while shown, so the
  // mount itself stays silent
  useEffect(() => {
    if (!show) return

    const id = setTimeout(() => {
      setShow(false)
    }, displayMs)

    return () => clearTimeout(id)
  }, [show, text, displayMs])

  return (
    <CSSTransition
      nodeRef={nodeRef}
      in={show}
      timeout={500}
      classNames={{
        enterActive: styles.enterActive,
        enterDone: styles.enterDone,
        exitActive: styles.exitActive,
      }}
    >
      <div ref={nodeRef} className={styles.container} translate='no'>
        <div className={styles.innerContainer}>
          <div className={styles.value}>
            {text}
          </div>
        </div>
      </div>
    </CSSTransition>
  )
}

export default VolumeToast
