import React, { useState, useEffect, useRef } from 'react'
import { CSSTransition } from 'react-transition-group'
import styles from './PitchToast.css'

interface PitchToastProps {
  pitchSemitones: number
}

// transient toast mirroring UpNow on the left edge: shows the newly
// selected pitch for a moment on every change (mount is silent)
const DISPLAY_MS = 2500

const formatPitch = (pitchSemitones: number): string => (
  `${pitchSemitones > 0 ? '+' : ''}${pitchSemitones} st`
)

const PitchToast = ({ pitchSemitones }: PitchToastProps) => {
  const [show, setShow] = useState(false)
  const [text, setText] = useState('')
  const timeoutID = useRef<ReturnType<typeof setTimeout> | null>(null)
  const nodeRef = useRef<HTMLDivElement | null>(null)
  const prevSemitones = useRef(pitchSemitones)

  useEffect(() => {
    if (pitchSemitones === prevSemitones.current) return

    prevSemitones.current = pitchSemitones

    if (timeoutID.current) {
      clearTimeout(timeoutID.current)
    }

    setText(formatPitch(pitchSemitones))
    setShow(true)

    timeoutID.current = setTimeout(() => {
      setShow(false)
    }, DISPLAY_MS)

    return () => {
      if (timeoutID.current) {
        clearTimeout(timeoutID.current)
      }
    }
  }, [pitchSemitones])

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
