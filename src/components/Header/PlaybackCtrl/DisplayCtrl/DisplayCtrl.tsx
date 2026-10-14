import React, { useState } from 'react'
import clsx from 'clsx'
import { FormattedMessage, useIntl } from 'react-intl'
import Modal, { ModalProps } from 'components/Modal/Modal'
import Accordion from 'components/Accordion/Accordion'
import Button from 'components/Button/Button'
import InputCheckbox from 'components/InputCheckbox/InputCheckbox'
import Slider from 'components/Slider/Slider'
import Icon from 'components/Icon/Icon'
import EqualizerDialog from './EqualizerDialog'
import RoomOptions from './RoomOptions/RoomOptions'
import { PITCH_SEMITONE_MAX, PITCH_SEMITONE_MIN, clampPitchSemitones } from 'routes/Player/lib/pitchShift'
import styles from './DisplayCtrl.css'
import { MediaType, PlaybackOptions } from 'shared/types'
import { commonMessages } from '../../../../lib/messages'
import { headerMessages } from '../../messages'

interface DisplayCtrlProps {
  cdgAlpha: number
  cdgSize: number
  isPitchAdjustable: boolean
  isPitchSupported: boolean | null
  isVideoKeyingEnabled: boolean
  isVisualizerEnabled: boolean
  isWebGLSupported: boolean
  mediaType?: MediaType
  mp4Alpha: number
  pitchSemitones: number
  isReplayGainEnabled: boolean
  eqEnabled: boolean
  eqGains: number[]
  eqPreset: string
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
  isPitchSupported,
  isVideoKeyingEnabled,
  isVisualizerEnabled,
  isWebGLSupported,
  mediaType = '',
  mp4Alpha,
  pitchSemitones,
  isReplayGainEnabled,
  eqEnabled,
  eqGains,
  eqPreset,
  sensitivity,
  visualizerPresetName,
  onRequestOptions,
  onClose,
}: DisplayCtrlProps) => {
  const [isEqualizerOpen, setEqualizerOpen] = useState(false)
  const intl = useIntl()
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

  // AudioWorklet needs a secure context: plain HTTP over LAN can never
  // support pitch, while localhost and HTTPS can
  const insecureContext = typeof window !== 'undefined' && window.isSecureContext === false

  const handleToggleVisualizer = () => onRequestOptions({
    visualizer: { isEnabled: !isVisualizerEnabled },
  })

  const handleToggleReplayGain = () => onRequestOptions({
    isReplayGainEnabled: !isReplayGainEnabled,
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
      title={intl.formatMessage(commonMessages.playerOptions)}
      buttons={(
        <Button variant='primary' onClick={onClose}>
          <FormattedMessage {...commonMessages.done} />
        </Button>
      )}
    >
      <div className={styles.container}>
        <div className={clsx(styles.section, styles.visualizer)}>
          <fieldset>
            <legend>
              <InputCheckbox
                label={intl.formatMessage(headerMessages.visualizer)}
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
                      aria-label={intl.formatMessage(headerMessages.prevPreset)}
                      aria-controls='visualizer-preset-name'
                    >
                      <Icon icon='CHEVRON_LEFT' />
                    </Button>
                    <Button
                      onClick={handlePresetRandom}
                      aria-label={intl.formatMessage(headerMessages.randomPreset)}
                      aria-controls='visualizer-preset-name'
                    >
                      <Icon icon='DICE' />
                    </Button>
                    <Button
                      onClick={handlePresetNext}
                      aria-label={intl.formatMessage(headerMessages.nextPreset)}
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
                  <label id='label-visualizer-sensitivity'>
                    <FormattedMessage {...headerMessages.sensitivity} />
                  </label>
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
              && (
                <p className={styles.unsupported}>
                  <FormattedMessage {...headerMessages.vizUnavailable} />
                </p>
              )}

            {!isWebGLSupported
              && (
                <p className={styles.unsupported}>
                  <FormattedMessage {...headerMessages.noWebGL} />
                </p>
              )}
          </fieldset>
        </div>

        <RoomOptions />

        <Accordion
          initialExpanded
          headingComponent={(
            <div className={styles.heading}>
              <Icon icon='VOLUME_UP' />
              <div className={styles.title}>
                <FormattedMessage {...headerMessages.sound} />
              </div>
            </div>
          )}
        >
          <div className={styles.container}>
            {isPitchAdjustable && (
              <div className={clsx(styles.section, styles.pitch)}>
                <fieldset>
                  <legend>
                    <label><FormattedMessage {...headerMessages.pitch} /></label>
                  </legend>

                  <div className={styles.pitchButtons}>
                    <Button
                      onClick={handlePitchDown}
                      disabled={isPitchSupported === false || pitchSemitones <= PITCH_SEMITONE_MIN}
                      aria-label={intl.formatMessage(headerMessages.pitchDown)}
                      className={styles.step}
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
                      disabled={isPitchSupported === false || pitchSemitones >= PITCH_SEMITONE_MAX}
                      aria-label={intl.formatMessage(headerMessages.pitchUp)}
                      className={styles.step}
                    >
                      <Icon icon='CHEVRON_RIGHT' />
                    </Button>
                    <Button
                      onClick={handlePitchReset}
                      disabled={isPitchSupported === false || pitchSemitones === 0}
                      aria-label={intl.formatMessage(headerMessages.pitchReset)}
                      variant='primary'
                      className={styles.reset}
                    >
                      <FormattedMessage {...headerMessages.reset} />
                    </Button>
                  </div>
                  {isPitchSupported === false && (
                    <p className={styles.unsupported}>
                      {insecureContext
                        ? (
                            <FormattedMessage {...headerMessages.pitchInsecure} />
                          )
                        : (
                            <FormattedMessage {...headerMessages.pitchUnavailable} />
                          )}
                    </p>
                  )}
                </fieldset>
              </div>
            )}

            <div className={styles.container}>
              <Button
                variant='default'
                onClick={() => setEqualizerOpen(true)}
              >
                <FormattedMessage {...commonMessages.equalizer} />
              </Button>
            </div>

            <div className={styles.container}>
              <InputCheckbox
                label={intl.formatMessage(headerMessages.replayGain)}
                checked={isReplayGainEnabled}
                onChange={handleToggleReplayGain}
              />
            </div>
          </div>
        </Accordion>

        {isEqualizerOpen && (
          <EqualizerDialog
            eqEnabled={eqEnabled}
            eqGains={eqGains}
            eqPreset={eqPreset}
            onRequestOptions={onRequestOptions}
            onClose={() => setEqualizerOpen(false)}
          />
        )}

        <div className={clsx(styles.section, styles.lyrics)}>
          <fieldset>
            <legend>
              <label><FormattedMessage {...headerMessages.lyrics} /></label>
            </legend>

            {mediaType === 'cdg' && (
              <div className={styles.field}>
                <label id='label-lyrics-size'>
                  <FormattedMessage {...headerMessages.lyricsSize} />
                </label>
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
                <label id='label-lyrics-background'>
                  <FormattedMessage {...headerMessages.lyricsBackground} />
                </label>
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
              <p className={styles.unsupported}>
                <FormattedMessage {...headerMessages.noOptions} />
              </p>
            )}
          </fieldset>
        </div>
      </div>
    </Modal>
  )
}

export default DisplayCtrl
