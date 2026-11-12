import React from 'react'
import { useIntl } from 'react-intl'
import Button from 'components/Button/Button'
import InputCheckbox from 'components/InputCheckbox/InputCheckbox'
import Slider from 'components/Slider/Slider'
import Icon from 'components/Icon/Icon'
import RoomOptions from './RoomOptions/RoomOptions'
import styles from './DisplayCtrl.css'
import { MediaType, PlaybackOptions } from 'shared/types'
import { headerMessages } from '../../../messages'

interface DisplayCtrlProps {
  cdgAlpha: number
  cdgSize: number
  isVideoKeyingEnabled: boolean
  isVisualizerEnabled: boolean
  isWebGLSupported: boolean
  mediaType?: MediaType
  mp4Alpha: number
  sensitivity: number
  visualizerPresetName: string
  // actions
  onRequestOptions(opts: PlaybackOptions): void
}

const DisplayCtrl = ({
  cdgAlpha,
  cdgSize,
  isVideoKeyingEnabled,
  isVisualizerEnabled,
  isWebGLSupported,
  mediaType = '',
  mp4Alpha,
  sensitivity,
  visualizerPresetName,
  onRequestOptions,
}: DisplayCtrlProps) => {
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
    <>
      <div className={styles.visualizer}>
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
                    animateClassName={styles.presetAnimate}
                    aria-label={intl.formatMessage(headerMessages.prevPreset)}
                    aria-controls='visualizer-preset-name'
                  >
                    <Icon icon='CHEVRON_LEFT' />
                  </Button>
                  <Button
                    onClick={handlePresetRandom}
                    animateClassName={styles.presetAnimate}
                    aria-label={intl.formatMessage(headerMessages.randomPreset)}
                    aria-controls='visualizer-preset-name'
                  >
                    <Icon icon='DICE' />
                  </Button>
                  <Button
                    onClick={handlePresetNext}
                    animateClassName={styles.presetAnimate}
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
                <label id='label-visualizer-sensitivity'>{intl.formatMessage(headerMessages.sensitivity)}</label>
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
            && <p className={styles.unsupported}>{intl.formatMessage(headerMessages.vizUnavailable)}</p>}

          {!isWebGLSupported
            && <p className={styles.unsupported}>{intl.formatMessage(headerMessages.noWebGL)}</p>}
        </fieldset>
      </div>

      <div>
        <fieldset>
          <legend>
            <label>{intl.formatMessage(headerMessages.lyrics)}</label>
          </legend>

          {mediaType === 'cdg' && (
            <div className={styles.field}>
              <label id='label-lyrics-size'>{intl.formatMessage(headerMessages.lyricsSize)}</label>
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
              <label id='label-lyrics-background'>{intl.formatMessage(headerMessages.lyricsBackground)}</label>
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
            <p className={styles.unsupported}>{intl.formatMessage(headerMessages.noOptions)}</p>
          )}
        </fieldset>
      </div>

      <RoomOptions />
    </>
  )
}

export default DisplayCtrl
