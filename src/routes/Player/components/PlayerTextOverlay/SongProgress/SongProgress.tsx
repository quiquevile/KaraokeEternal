import React, { useEffect, useRef, useState } from 'react'
import type { IRoomPrefs } from 'shared/types'
import { formatPitch, formatRemaining } from '../../../lib/playerDisplay'
import styles from './SongProgress.css'

interface SongProgressProps {
  position: number
  duration: number
  artist?: string
  title?: string
  singer?: string
  pitchSemitones?: number
  progress?: IRoomPrefs['progress']
}

// half the original speed; pauses in seconds (start pause before scrolling again)
const SCROLL_SPEED_PX_S = 25
const MIN_LEG_S = 2
const END_PAUSE_S = 1.5
const START_PAUSE_S = 5

let marqueeUid = 0

const TitleMarquee = ({ text }: { text: string }) => {
  const wrapRef = useRef<HTMLDivElement>(null)
  const textRef = useRef<HTMLSpanElement>(null)
  const [overflow, setOverflow] = useState(0)
  const [animName] = useState(() => `song-title-marquee-${++marqueeUid}`)
  const [reducedMotion] = useState(
    () => typeof window !== 'undefined'
      && typeof window.matchMedia === 'function'
      && window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  )

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

  if (overflow === 0 || reducedMotion) {
    return (
      <div key={text} ref={wrapRef} className={styles.title}>
        <span ref={textRef} className={styles.titleText}>{text}</span>
      </div>
    )
  }

  const leg = Math.max(MIN_LEG_S, overflow / SCROLL_SPEED_PX_S)
  const total = leg + END_PAUSE_S + leg + START_PAUSE_S
  const toPct = (seconds: number) => `${(seconds / total) * 100}%`
  const dist = -overflow
  const keyframes = `@keyframes ${animName} {
    0% { transform: translateX(0); }
    ${toPct(leg)} { transform: translateX(${dist}px); }
    ${toPct(leg + END_PAUSE_S)} { transform: translateX(${dist}px); }
    ${toPct(leg + END_PAUSE_S + leg)} { transform: translateX(0); }
    100% { transform: translateX(0); }
  }`

  return (
    <div key={text} ref={wrapRef} className={styles.title}>
      <style>
        {keyframes}
      </style>
      <span
        ref={textRef}
        className={styles.marqueeText}
        style={{
          animationName: animName,
          animationDuration: `${total}s`,
        }}
      >
        {text}
      </span>
    </div>
  )
}

// always-on song progress readout along the bottom edge: slim progress
// bar plus remaining time, karaoke-machine style (display only, no seek)
const SongProgress = ({ position, duration, artist, title, singer, pitchSemitones = 0, progress }: SongProgressProps) => {
  const remaining = formatRemaining(position, duration)

  if (remaining === null) return null

  const pct = Math.min(100, Math.max(0, (position / duration) * 100))
  const songText = [artist, title].filter(Boolean).join(' - ')
    + (pitchSemitones !== 0 ? ` (${formatPitch(pitchSemitones)})` : '')
  const showTitle = progress?.showTitle ?? true
  const showSinger = progress?.showSinger ?? true
  const showTime = progress?.showTime ?? true

  return (
    <div className={styles.container} translate='no'>
      {showTitle && songText && <TitleMarquee text={songText} />}
      <div className={styles.barWrap}>
        <div className={styles.bar}>
          <div className={styles.fill} style={{ width: `${pct}%` }} />
        </div>
        {showSinger && singer && <div className={styles.singer}>{singer}</div>}
      </div>
      {showTime && (
        <div className={styles.time}>
          {remaining}
        </div>
      )}
    </div>
  )
}

export default SongProgress
