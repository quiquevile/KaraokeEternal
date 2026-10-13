import React, { useState, useEffect, useRef } from 'react'
import { FormattedMessage } from 'react-intl'
import { NEXTUP_FADE_MS } from '../../../lib/playerDisplay'
import styles from './NextUp.css'

interface NextUpProps {
  displayName: string
  blinkMs: number
}

// transient badge mirroring UpNow on the right edge, without the photo and
// at half the font size: announces the next singer near the end of the
// current song, blinking (on blinkMs / off blinkMs, fixed fade) so it
// doesn't get in the way
const NextUp = ({ displayName, blinkMs }: NextUpProps) => {
  const [dimmed, setDimmed] = useState(false)
  const nodeRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (blinkMs <= 0) return

    const timeoutID = setTimeout(() => {
      setDimmed(prev => !prev)
    }, blinkMs)

    return () => clearTimeout(timeoutID)
  }, [dimmed, blinkMs])

  return (
    <div ref={nodeRef} className={styles.container} translate='no'>
      <div
        className={`${styles.innerContainer} ${dimmed ? styles.dimmed : ''}`}
        style={{ transitionDuration: `${NEXTUP_FADE_MS}ms` }}
      >
        <div className={styles.next}>
          <FormattedMessage
            id='player.nextUp.next'
            defaultMessage='Next: {name}'
            values={{ name: displayName }}
          />
        </div>
      </div>
    </div>
  )
}

export default NextUp
