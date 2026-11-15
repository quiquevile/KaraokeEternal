import React, { useCallback } from 'react'
import { useIntl } from 'react-intl'
import InputCheckbox from 'components/InputCheckbox/InputCheckbox'
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
    <fieldset>
      <legend>
        <label>{intl.formatMessage(headerMessages.qrCode)}</label>
      </legend>
      <div>
        <InputCheckbox
          label={intl.formatMessage(headerMessages.showQr)}
          checked={prefs?.qr?.isEnabled ?? false}
          onChange={event => handleSetPref({ qr: { ...prefs.qr, isEnabled: event.currentTarget.checked } })}
        />
      </div>
      {prefs?.qr?.isEnabled && (
        <div>
          <input
            type='text'
            autoComplete='off'
            inputMode='url'
            value={prefs?.qr?.url ?? ''}
            onChange={e => handleSetPref({ qr: { ...prefs.qr, url: e.target.value || undefined } })}
            onFocus={e => e.target.select()}
            placeholder={intl.formatMessage(headerMessages.qrUrl)}
          />
        </div>
      )}
      {passwordPresent && (
        <div>
          <InputCheckbox
            label={intl.formatMessage(headerMessages.qrPassword)}
            checked={prefs?.qr?.includePassword ?? false}
            onChange={event => handleSetPref({ qr: { ...prefs.qr, includePassword: event.currentTarget.checked } })}
          />
        </div>
      )}
      <div>
        <label id='label-qr-size'>
          {intl.formatMessage(headerMessages.qrSize)}
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
      <div>
        <label id='label-qr-opacity'>
          {intl.formatMessage(headerMessages.qrOpacity)}
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
  )
}

export default QRPrefs
