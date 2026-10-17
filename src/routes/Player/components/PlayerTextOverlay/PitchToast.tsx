import React, { useState, useEffect, useRef } from 'react'
import { CSSTransition } from 'react-transition-group'
import { formatPitch } from '../../lib/playerDisplay'
import styles from './PitchToast.css'

interface PitchToastProps {
  pitchSemitones: number
  displayMs: number
  // song (re)start signals: replay of the same song only bumps replayKey,
  // while queueId/mediaId cover advancing to (or restarting) another song
  replayKey: number
  queueId: number
  mediaId: number | null
}

// transient toast mirroring UpNow on the left edge: shows the current
// pitch for a moment on every change and on song start (when non-zero;
// mount is silent)
const PitchToast = ({ pitchSemitones, displayMs, replayKey, queueId, mediaId }: PitchToastProps) => {
  const [show, setShow] = useState(false)
  const [text, setText] = useState('')
  const nodeRef = useRef<HTMLDivElement | null>(null)
  const [prev, setPrev] = useState({ pitchSemitones, replayKey, queueId, mediaId })

  // react to prop changes during render (previous-props comparison), so
  // showing the toast never has to trigger a cascading effect render
  const pitchChanged = prev.pitchSemitones !== pitchSemitones
  const startChanged = prev.replayKey !== replayKey
    || prev.queueId !== queueId
    || prev.mediaId !== mediaId

  if (pitchChanged || (startChanged && pitchSemitones !== 0)) {
    setPrev({ pitchSemitones, replayKey, queueId, mediaId })
    setText(formatPitch(pitchSemitones))
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

export default PitchToast
