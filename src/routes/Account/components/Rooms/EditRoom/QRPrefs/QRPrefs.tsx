import React, { useCallback } from 'react'
import clsx from 'clsx'
import Accordion from 'components/Accordion/Accordion'
import InputCheckbox from 'components/InputCheckbox/InputCheckbox'
import Icon from 'components/Icon/Icon'
import Slider from 'components/Slider/Slider'
import type { IRoomPrefs } from 'shared/types'
import styles from './QRPrefs.css'

interface QRPrefsProps {
  prefs: Partial<IRoomPrefs>
  onChange: (prefs: Partial<IRoomPrefs>) => void
  // whether the room currently has a key (main form field in EditRoom,
  // room metadata in Display): without one the checkbox stays off
  passwordPresent: boolean
}

const QRPrefs = ({ onChange, prefs = {}, passwordPresent }: QRPrefsProps) => {
  // embedding needs both the flag and an actual key; the flag alone only
  // records the preference for when a key exists
  const includePassword = (prefs?.qr?.includePassword ?? false) && passwordPresent

  const handleSetPref = useCallback((update: Partial<IRoomPrefs>) => {
    onChange({ ...prefs, ...update })
  }, [onChange, prefs])

  return (
    <Accordion
      headingComponent={(
        <div className={styles.heading}>
          <Icon icon='QR_CODE' />
          <div className={styles.title}>QR Code</div>
        </div>
      )}
    >
      <div className={styles.content}>
        <div className={styles.field}>
          <InputCheckbox
            label='Show QR code'
            checked={prefs?.qr?.isEnabled ?? false}
            onChange={event => handleSetPref({ qr: { ...prefs.qr, isEnabled: event.currentTarget.checked } })}
          />
        </div>
        <div className={styles.field}>
          <InputCheckbox
            label='Include room password'
            checked={includePassword}
            disabled={!passwordPresent}
            onChange={event => handleSetPref({ qr: { ...prefs.qr, includePassword: event.currentTarget.checked } })}
          />
        </div>
        <div className={clsx(styles.field)}>
          <label id='label-qr-size'>Size</label>
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
          <label id='label-qr-opacity'>Opacity</label>
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
      </div>
    </Accordion>
  )
}

export default QRPrefs
