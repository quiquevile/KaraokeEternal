import React from 'react'
import Button from 'components/Button/Button'
import InputCheckbox from 'components/InputCheckbox/InputCheckbox'
import Modal, { ModalProps } from 'components/Modal/Modal'
import Slider from 'components/Slider/Slider'
import sliderStyles from 'components/Slider/Slider.css'
import { EQ_FREQUENCIES, EQ_GAIN_MAX, EQ_GAIN_MIN, EQ_PRESETS } from 'routes/Player/lib/equalizer'
import styles from './EqualizerDialog.css'
import { PlaybackOptions } from 'shared/types'

interface EqualizerDialogProps {
  eqEnabled: boolean
  eqGains: number[]
  eqPreset: string
  // actions
  onRequestOptions(opts: PlaybackOptions): void
  onClose: ModalProps['onClose']
}

const formatFreq = (freq: number): string => (
  freq >= 1000 ? `${freq / 1000}k` : `${freq}`
)

const EqualizerDialog = ({
  eqEnabled,
  eqGains,
  eqPreset,
  onRequestOptions,
  onClose,
}: EqualizerDialogProps) => {
  const handleToggle = () => onRequestOptions({ eqEnabled: !eqEnabled })

  const handleBand = (index: number, value: number) => {
    const gains = eqGains.slice()
    gains[index] = value
    onRequestOptions({ eqGains: gains, eqPreset: 'Custom' })
  }

  const handlePreset = (name: string) => {
    const preset = EQ_PRESETS.find(p => p.name === name)
    if (!preset) return

    onRequestOptions({ eqGains: preset.gains.slice(), eqPreset: preset.name })
  }

  return (
    <Modal
      onClose={onClose}
      title='Equalizer'
      buttons={<Button variant='primary' onClick={onClose}>Done</Button>}
    >
      <div className={styles.container}>
        <InputCheckbox
          label='Equalizer'
          checked={eqEnabled}
          onChange={handleToggle}
        />

        <div className={styles.presets}>
          {EQ_PRESETS.map(preset => (
            <Button
              key={preset.name}
              variant={eqPreset === preset.name && eqEnabled ? 'primary' : 'default'}
              className={styles.preset}
              onClick={() => handlePreset(preset.name)}
              aria-pressed={eqPreset === preset.name}
            >
              {preset.name}
            </Button>
          ))}
        </div>

        <div className={styles.bands}>
          {EQ_FREQUENCIES.map((freq, index) => {
            const gain = eqGains[index] ?? 0

            return (
              <div key={freq} className={styles.band}>
                <Slider
                  vertical
                  min={EQ_GAIN_MIN}
                  max={EQ_GAIN_MAX}
                  step={0.5}
                  value={gain}
                  onChange={(value: number) => handleBand(index, value)}
                  aria-label={`${formatFreq(freq)} Hz`}
                  className={`${styles.slider} ${sliderStyles.small}`}
                />
                <span className={styles.freq}>{formatFreq(freq)}</span>
                <span className={styles.value}>
                  {gain > 0 ? '+' : ''}
                  {gain.toFixed(1)}
                </span>
              </div>
            )
          })}
        </div>
      </div>
    </Modal>
  )
}

export default EqualizerDialog
