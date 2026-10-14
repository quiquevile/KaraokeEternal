import React, { useCallback } from 'react'
import clsx from 'clsx'
import { FormattedMessage, useIntl } from 'react-intl'
import Accordion from 'components/Accordion/Accordion'
import InputCheckbox from 'components/InputCheckbox/InputCheckbox'
import Icon from 'components/Icon/Icon'
import Slider from 'components/Slider/Slider'
import type { IRoomPrefs } from 'shared/types'
import styles from './QRPrefs.css'
import { headerMessages } from '../../../../messages'

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
            <FormattedMessage {...headerMessages.display} />
          </div>
        </div>
      )}
    >
      <div className={styles.content}>
        <fieldset className={styles.qrBox}>
          <legend>
            <label><FormattedMessage {...headerMessages.qrCode} /></label>
          </legend>
          <div className={styles.field}>
            <InputCheckbox
              label={intl.formatMessage(headerMessages.showQr)}
              checked={prefs?.qr?.isEnabled ?? false}
              onChange={event => handleSetPref({ qr: { ...prefs.qr, isEnabled: event.currentTarget.checked } })}
            />
          </div>
          {passwordPresent && (
            <div className={styles.field}>
              <InputCheckbox
                label={intl.formatMessage(headerMessages.qrPassword)}
                checked={prefs?.qr?.includePassword ?? false}
                onChange={event => handleSetPref({ qr: { ...prefs.qr, includePassword: event.currentTarget.checked } })}
              />
            </div>
          )}
          <div className={clsx(styles.field)}>
            <label id='label-qr-size'>
              <FormattedMessage {...headerMessages.qrSize} />
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
              <FormattedMessage {...headerMessages.qrOpacity} />
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
            label={intl.formatMessage(headerMessages.showProgress)}
            checked={prefs?.progress?.isEnabled ?? true}
            onChange={event => handleSetPref({ progress: { ...prefs.progress, isEnabled: event.currentTarget.checked } })}
          />
        </div>
      </div>
    </Accordion>
  )
}

export default QRPrefs
