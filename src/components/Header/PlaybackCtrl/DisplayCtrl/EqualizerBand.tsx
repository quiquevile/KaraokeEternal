import React, { useEffect, useRef, useState } from 'react'
import Button from 'components/Button/Button'
import Slider from 'components/Slider/Slider'
import sliderStyles from 'components/Slider/Slider.css'
import { EQ_GAIN_MAX, EQ_GAIN_MIN, clampEqGain, formatFreq, parseGainInput } from 'routes/Player/lib/equalizer'
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
