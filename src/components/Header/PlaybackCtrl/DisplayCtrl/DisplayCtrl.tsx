import React from 'react'
import clsx from 'clsx'
import Modal, { ModalProps } from 'components/Modal/Modal'
import Button from 'components/Button/Button'
import InputCheckbox from 'components/InputCheckbox/InputCheckbox'
import Slider from 'components/Slider/Slider'
import Icon from 'components/Icon/Icon'
import { PITCH_SEMITONE_MAX, PITCH_SEMITONE_MIN, clampPitchSemitones } from 'routes/Player/lib/pitchShift'
import styles from './DisplayCtrl.css'
import { MediaType, PlaybackOptions } from 'shared/types'

interface DisplayCtrlProps {
  cdgAlpha: number
  cdgSize: number
  isPitchAdjustable: boolean
  isVideoKeyingEnabled: boolean
  isVisualizerEnabled: boolean
  isWebGLSupported: boolean
  mediaType?: MediaType
  mp4Alpha: number
  pitchSemitones: number
  sensitivity: number
  visualizerPresetName: string
  // actions
  onRequestOptions(opts: PlaybackOptions): void
  onClose: ModalProps['onClose']
}

const DisplayCtrl = ({
  cdgAlpha,
  cdgSize,
  isPitchAdjustable,
  isVideoKeyingEnabled,
  isVisualizerEnabled,
  isWebGLSupported,
  mediaType = '',
  mp4Alpha,
  pitchSemitones,
  sensitivity,
  visualizerPresetName,
  onRequestOptions,
  onClose,
}: DisplayCtrlProps) => {
  const handleAlpha = (val: number) => {
    if (mediaType === '') return
    onRequestOptions({ [mediaType + 'Alpha']: val })
  }

  const handleSensitivity = (val: number) => onRequestOptions({
    visualizer: { sensitivity: val },
  })

  const handleSize = (val: number) => {
    onRequestOptions({ cdgSize: val })
  }

  const handlePitchDown = () => onRequestOptions({
    pitchSemitones: clampPitchSemitones(pitchSemitones - 1),
  })

  const handlePitchUp = () => onRequestOptions({
    pitchSemitones: clampPitchSemitones(pitchSemitones + 1),
  })

  const handlePitchReset = () => onRequestOptions({ pitchSemitones: 0 })

  const formattedPitch = `${pitchSemitones > 0 ? '+' : ''}${pitchSemitones} st`

  const handleToggleVisualizer = () => onRequestOptions({
    visualizer: { isEnabled: !isVisualizerEnabled },
  })

  const handlePresetNext = () => onRequestOptions({
    visualizer: { nextPreset: true },
  })

  const handlePresetPrev = () => onRequestOptions({
    visualizer: { prevPreset: true },
  })

  const handlePresetRandom = () => onRequestOptions({
    visualizer: { randomPreset: true },
  })

  return (
    <Modal
      className={styles.modal}
      onClose={onClose}
      title='Display'
      buttons={<Button variant='primary' onClick={onClose}>Done</Button>}
    >
      <div className={styles.container}>
        <div className={clsx(styles.section, styles.visualizer)}>
          <fieldset>
            <legend>
              <InputCheckbox
                label='Visualizer'
                checked={isVisualizerEnabled}
                disabled={!isWebGLSupported}
                onChange={handleToggleVisualizer}
              />
            </legend>

            {isWebGLSupported && (mediaType === 'cdg' || isVideoKeyingEnabled) && (
              <>
                <div className={styles.presetContainer}>
                  <div className={styles.presetButtons}>
                    <Button
                      onClick={handlePresetPrev}
                      aria-label='Previous preset'
                      aria-controls='visualizer-preset-name'
                    >
                      <Icon icon='CHEVRON_LEFT' />
                    </Button>
                    <Button
                      onClick={handlePresetRandom}
                      aria-label='Random preset'
                      aria-controls='visualizer-preset-name'
                    >
                      <Icon icon='DICE' />
                    </Button>
                    <Button
                      onClick={handlePresetNext}
                      aria-label='Next preset'
                      aria-controls='visualizer-preset-name'
                    >
                      <Icon icon='CHEVRON_RIGHT' />
                    </Button>
                  </div>
                  <p
                    id='visualizer-preset-name'
                    className={styles.presetName}
                    aria-live='polite'
                    translate='no'
                  >
                    {visualizerPresetName}
                  </p>
                </div>

                <div className={styles.field}>
                  <label id='label-visualizer-sensitivity'>Sensitivity</label>
                  <Slider
                    min={0}
                    max={2}
                    step={0.01}
                    value={sensitivity}
                    onChange={handleSensitivity}
                    className={styles.slider}
                    aria-labelledby='label-visualizer-sensitivity'
                  />
                </div>
              </>
            )}

            {isWebGLSupported && mediaType !== 'cdg' && !isVideoKeyingEnabled
              && <p className={styles.unsupported}>Not available for this media type</p>}

            {!isWebGLSupported
              && <p className={styles.unsupported}>WebGL not supported</p>}
          </fieldset>
        </div>

        {isPitchAdjustable && (
          <div className={clsx(styles.section, styles.pitch)}>
            <fieldset>
              <legend>
                <label>Pitch</label>
              </legend>

              <div className={styles.pitchButtons}>
                <Button
                  onClick={handlePitchDown}
                  disabled={pitchSemitones <= PITCH_SEMITONE_MIN}
                  aria-label='Lower pitch by one semitone'
                >
                  <Icon icon='CHEVRON_LEFT' />
                </Button>
                <p
                  className={styles.pitchValue}
                  aria-live='polite'
                >
                  {formattedPitch}
                </p>
                <Button
                  onClick={handlePitchUp}
                  disabled={pitchSemitones >= PITCH_SEMITONE_MAX}
                  aria-label='Raise pitch by one semitone'
                >
                  <Icon icon='CHEVRON_RIGHT' />
                </Button>
                <Button
                  onClick={handlePitchReset}
                  disabled={pitchSemitones === 0}
                  aria-label='Reset pitch'
                >
                  Reset
                </Button>
              </div>
            </fieldset>
          </div>
        )}

        <div className={clsx(styles.section, styles.lyrics)}>
          <fieldset>
            <legend>
              <label>Lyrics</label>
            </legend>

            {mediaType === 'cdg' && (
              <div className={styles.field}>
                <label id='label-lyrics-size'>Size</label>
                <Slider
                  min={0.4}
                  max={0.9}
                  step={0.01}
                  value={cdgSize}
                  onChange={handleSize}
                  className={styles.slider}
                  aria-labelledby='label-lyrics-size'
                />
              </div>
            )}

            {(mediaType === 'cdg' || isVideoKeyingEnabled) && (
              <div className={styles.field}>
                <label id='label-lyrics-background'>Background</label>
                <Slider
                  min={0}
                  max={1}
                  step={0.01}
                  value={mediaType === 'cdg' ? cdgAlpha : mp4Alpha}
                  onChange={handleAlpha}
                  className={styles.slider}
                  aria-labelledby='label-lyrics-background'
                />
              </div>
            )}

            {mediaType !== 'cdg' && !isVideoKeyingEnabled && (
              <p className={styles.unsupported}>No options available</p>
            )}
          </fieldset>
        </div>
      </div>
    </Modal>
  )
}

export default DisplayCtrl
