import React, { useEffect, useRef, useState } from 'react'
import { formatRemaining } from '../../../lib/playerDisplay'
import styles from './SongProgress.css'

interface SongProgressProps {
  position: number
  duration: number
  artist?: string
  title?: string
  singer?: string
}

// ~50px/s scroll leg; fixed keyframe shape (38% legs, 12% pauses)
const SCROLL_SPEED_PX_S = 50
const MIN_LEG_S = 2
const LEG_FRACTION = 0.38

const TitleMarquee = ({ text }: { text: string }) => {
  const wrapRef = useRef<HTMLDivElement>(null)
  const textRef = useRef<HTMLSpanElement>(null)
  const [overflow, setOverflow] = useState(0)

  useEffect(() => {
    let cancelled = false

    const measure = () => {
      if (cancelled) return

      const wrap = wrapRef.current
      const el = textRef.current

      if (!wrap || !el) return

      setOverflow(Math.max(0, el.scrollWidth - wrap.clientWidth))
    }

    measure()

    const wrap = wrapRef.current

    if (wrap && typeof ResizeObserver !== 'undefined') {
      const observer = new ResizeObserver(measure)
      observer.observe(wrap)

      return () => {
        cancelled = true
        observer.disconnect()
      }
    }

    // re-measure once webfonts settle (widths shift under the text)
    if (typeof document !== 'undefined' && document.fonts) {
      void document.fonts.ready.then(measure)
    }

    return () => {
      cancelled = true
    }
  }, [text])

  if (overflow === 0) {
    return (
      <div key={text} ref={wrapRef} className={styles.title}>
        <span ref={textRef} className={styles.titleText}>{text}</span>
      </div>
    )
  }

  const leg = Math.max(MIN_LEG_S, overflow / SCROLL_SPEED_PX_S)

  return (
    <div key={text} ref={wrapRef} className={styles.title}>
      <span
        ref={textRef}
        className={styles.marqueeText}
        style={{
          ['--dist' as string]: `${-overflow}px`,
          animationDuration: `${leg / LEG_FRACTION}s`,
        } as React.CSSProperties}
      >
        {text}
      </span>
    </div>
  )
}

// always-on song progress readout along the bottom edge: slim progress
// bar plus remaining time, karaoke-machine style (display only, no seek)
const SongProgress = ({ position, duration, artist, title, singer }: SongProgressProps) => {
  const remaining = formatRemaining(position, duration)

  if (remaining === null) return null

  const pct = Math.min(100, Math.max(0, (position / duration) * 100))
  const songText = [artist, title].filter(Boolean).join(' - ')

  return (
    <div className={styles.container} translate='no'>
      {songText && <TitleMarquee text={songText} />}
      <div className={styles.barWrap}>
        <div className={styles.bar}>
          <div className={styles.fill} style={{ width: `${pct}%` }} />
        </div>
        {singer && <div className={styles.singer}>{singer}</div>}
      </div>
      <div className={styles.time}>
        {remaining}
      </div>
    </div>
  )
}

export default SongProgress
