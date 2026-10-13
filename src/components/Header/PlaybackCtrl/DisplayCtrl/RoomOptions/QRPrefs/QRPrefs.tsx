import React, { useCallback } from 'react'
import clsx from 'clsx'
import { FormattedMessage, useIntl } from 'react-intl'
import Accordion from 'components/Accordion/Accordion'
import InputCheckbox from 'components/InputCheckbox/InputCheckbox'
import Icon from 'components/Icon/Icon'
import Slider from 'components/Slider/Slider'
import type { IRoomPrefs } from 'shared/types'
import styles from './QRPrefs.css'

interface QRPrefsProps {
  prefs: Partial<IRoomPrefs>
  onChange: (prefs: Partial<IRoomPrefs>) => void
  // whether the current room has a key: without one the include-password
  // option is not shown at all
  passwordPresent: boolean
}

const QRPrefs = ({ onChange, prefs = {}, passwordPresent }: QRPrefsProps) => {
  const intl = useIntl()

  const handleSetPref = useCallback((update: Partial<IRoomPrefs>) => {
    onChange({ ...prefs, ...update })
  }, [onChange, prefs])

  return (
    <Accordion
      headingComponent={(
        <div className={styles.heading}>
          <Icon icon='QR_CODE' />
          <div className={styles.title}>
            <FormattedMessage id='playerOptions.display' defaultMessage='Display' />
          </div>
        </div>
      )}
    >
      <div className={styles.content}>
        <fieldset className={styles.qrBox}>
          <legend>
            <label><FormattedMessage id='playerOptions.qrCode' defaultMessage='QR code' /></label>
          </legend>
          <div className={styles.field}>
            <InputCheckbox
              label={intl.formatMessage({ id: 'playerOptions.showQr', defaultMessage: 'Show QR code' })}
              checked={prefs?.qr?.isEnabled ?? false}
              onChange={event => handleSetPref({ qr: { ...prefs.qr, isEnabled: event.currentTarget.checked } })}
            />
          </div>
          {passwordPresent && (
            <div className={styles.field}>
              <InputCheckbox
                label={intl.formatMessage({ id: 'playerOptions.qrPassword', defaultMessage: 'Include room password' })}
                checked={prefs?.qr?.includePassword ?? false}
                onChange={event => handleSetPref({ qr: { ...prefs.qr, includePassword: event.currentTarget.checked } })}
              />
            </div>
          )}
          <div className={clsx(styles.field)}>
            <label id='label-qr-size'>
              <FormattedMessage id='playerOptions.qrSize' defaultMessage='Size' />
            </label>
            <Slider
              className={styles.slider}
              min={0}
              max={1}
              step={0.05}
              value={prefs?.qr?.size ?? 0.5}
              onChange={(val: number) => handleSetPref({ qr: { ...prefs.qr, size: val } })}
              aria-labelledby='label-qr-size'
            />
          </div>
          <div className={clsx(styles.field)}>
            <label id='label-qr-opacity'>
              <FormattedMessage id='playerOptions.qrOpacity' defaultMessage='Opacity' />
            </label>
            <Slider
              className={styles.slider}
              min={0.25}
              max={1}
              step={0.075}
              value={prefs?.qr?.opacity ?? 0.625}
              onChange={(val: number) => handleSetPref({ qr: { ...prefs.qr, opacity: val } })}
              aria-labelledby='label-qr-opacity'
            />
          </div>
        </fieldset>
        <div className={styles.field}>
          <InputCheckbox
            label={intl.formatMessage({ id: 'playerOptions.showProgress', defaultMessage: 'Show progress bar' })}
            checked={prefs?.progress?.isEnabled ?? true}
            onChange={event => handleSetPref({ progress: { ...prefs.progress, isEnabled: event.currentTarget.checked } })}
          />
        </div>
      </div>
    </Accordion>
  )
}

export default QRPrefs
