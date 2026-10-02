import React, { useEffect, useRef, useState } from 'react'
import Button from 'components/Button/Button'
import Slider from 'components/Slider/Slider'
import sliderStyles from 'components/Slider/Slider.css'
import { EQ_GAIN_MAX, EQ_GAIN_MIN, TAP_MOVE_PX, clampEqGain, formatFreq, isDoubleTap, parseGainInput, type TapPoint } from 'routes/Player/lib/equalizer'
import styles from './EqualizerBand.css'

// nudge per stepper tap (sliders cover coarse moves with the same step)
const STEP = 0.1

const formatGain = (gain: number): string => (
  `${gain > 0 ? '+' : ''}${gain.toFixed(1)}`
)

interface EqualizerBandProps {
  freq: number
  gain: number
  disabled: boolean
  onChange: (value: number) => void
}

const EqualizerBand = ({ freq, gain, disabled, onChange }: EqualizerBandProps) => {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  // pending first tap + the point where the current press started
  const tapRef = useRef<{ pending: TapPoint | null, down: TapPoint | null }>({
    pending: null,
    down: null,
  })

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus()
      inputRef.current?.select()
    }
  }, [editing])

  const startEditing = () => {
    if (disabled) return

    setDraft(String(gain))
    setEditing(true)
  }

  const commitEditing = () => {
    const parsed = parseGainInput(draft)

    // garbage input reverts to the live value
    if (parsed !== null) onChange(parsed)

    setEditing(false)
  }

  const step = (delta: number) => {
    // round to 1 decimal to avoid float drift on repeated taps
    onChange(clampEqGain(Math.round((gain + delta) * 10) / 10))
  }

  // manual double-tap (native dblclick never fires on touch sliders)
  const pointOf = (e: React.PointerEvent): TapPoint => ({
    pointerId: e.pointerId,
    time: e.timeStamp,
    x: e.clientX,
    y: e.clientY,
  })

  const handlePointerDown = (e: React.PointerEvent) => {
    tapRef.current.down = pointOf(e)
  }

  const handlePointerUp = (e: React.PointerEvent) => {
    if (disabled) return

    const up = pointOf(e)
    const down = tapRef.current.down
    tapRef.current.down = null

    if (!down || down.pointerId !== up.pointerId) {
      tapRef.current.pending = null

      return
    }

    const dx = up.x - down.x
    const dy = up.y - down.y

    // a drag is not a tap
    if (dx * dx + dy * dy > TAP_MOVE_PX * TAP_MOVE_PX) {
      tapRef.current.pending = null

      return
    }

    if (isDoubleTap(tapRef.current.pending, up)) {
      tapRef.current.pending = null
      onChange(0)
    } else {
      tapRef.current.pending = up
    }
  }

  const handlePointerCancel = () => {
    tapRef.current = { pending: null, down: null }
  }

  return (
    <div className={styles.band}>
      <Button
        variant='default'
        className={styles.stepper}
        onClick={() => step(STEP)}
        disabled={disabled}
        aria-label={`Raise ${formatFreq(freq)} Hz by ${STEP} dB`}
      >
        +
      </Button>
      <div
        className={styles.fader}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
        title='Double-tap to reset to 0 dB'
      >
        <Slider
          vertical
          min={EQ_GAIN_MIN}
          max={EQ_GAIN_MAX}
          step={0.1}
          value={gain}
          onChange={onChange}
          disabled={disabled}
          handleIcon='HANDLE_VERT'
          aria-label={`${formatFreq(freq)} Hz`}
          className={`${styles.slider} ${sliderStyles.small}`}
        />
      </div>
      <Button
        variant='default'
        className={styles.stepper}
        onClick={() => step(-STEP)}
        disabled={disabled}
        aria-label={`Lower ${formatFreq(freq)} Hz by ${STEP} dB`}
      >
        −
      </Button>
      <span className={styles.freq}>{formatFreq(freq)}</span>
      {editing
        ? (
          <input
            ref={inputRef}
            className={styles.editor}
            value={draft}
            inputMode='decimal'
            autoComplete='off'
            onChange={e => setDraft(e.target.value)}
            onBlur={commitEditing}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitEditing()
              if (e.key === 'Escape') setEditing(false)
            }}
            aria-label={`${formatFreq(freq)} Hz gain in dB`}
          />
        )
        : (
          <button
            type='button'
            className={styles.value}
            onClick={startEditing}
            disabled={disabled}
            aria-label={`${formatFreq(freq)} Hz gain ${formatGain(gain)}, activate to edit`}
          >
            {formatGain(gain)}
          </button>
        )
      }
    </div>
  )
}

export default EqualizerBand
