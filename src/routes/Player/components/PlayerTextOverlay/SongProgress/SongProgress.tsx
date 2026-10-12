import React from 'react'
import { formatRemaining } from '../../../lib/playerDisplay'
import styles from './SongProgress.css'

interface SongProgressProps {
  position: number
  duration: number
}

// always-on song progress readout along the bottom edge: slim progress
// bar plus remaining time, karaoke-machine style (display only, no seek)
const SongProgress = ({ position, duration }: SongProgressProps) => {
  const remaining = formatRemaining(position, duration)

  if (remaining === null) return null

  const pct = Math.min(100, Math.max(0, (position / duration) * 100))

  return (
    <div className={styles.container} translate='no'>
      <div className={styles.time}>
        {remaining}
      </div>
      <div className={styles.bar}>
        <div className={styles.fill} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

export default SongProgress
