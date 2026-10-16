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
  const timeoutID = useRef<ReturnType<typeof setTimeout> | null>(null)
  const nodeRef = useRef<HTMLDivElement | null>(null)
  const prev = useRef({ pitchSemitones, replayKey, queueId, mediaId })

  useEffect(() => {
    const pitchChanged = prev.current.pitchSemitones !== pitchSemitones
    const startChanged = prev.current.replayKey !== replayKey
      || prev.current.queueId !== queueId
      || prev.current.mediaId !== mediaId

    prev.current = { pitchSemitones, replayKey, queueId, mediaId }

    if (!pitchChanged && !(startChanged && pitchSemitones !== 0)) return

    if (timeoutID.current) {
      clearTimeout(timeoutID.current)
    }

    setText(formatPitch(pitchSemitones))
    setShow(true)

    timeoutID.current = setTimeout(() => {
      setShow(false)
    }, displayMs)

    return () => {
      if (timeoutID.current) {
        clearTimeout(timeoutID.current)
      }
    }
  }, [pitchSemitones, replayKey, queueId, mediaId, displayMs])

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
