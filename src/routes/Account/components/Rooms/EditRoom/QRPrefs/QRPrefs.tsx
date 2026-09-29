import React, { useCallback, useEffect, useState } from 'react'
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
  roomPassword: string
  roomPasswordDirty: boolean
  // Display usage: no password box at all (non-admins must never touch keys)
  showPasswordBox?: boolean
  // Display usage: hide the include-password checkbox unless a value exists
  // (checked once, when mounted — no point offering what cannot work)
  hideIncludeUnlessValued?: boolean
}

const QRPrefs = ({
  onChange,
  prefs = {},
  roomPassword,
  roomPasswordDirty,
  showPasswordBox = true,
  hideIncludeUnlessValued = false,
}: QRPrefsProps) => {
  // the flag only toggles embedding; the stored value survives toggles and
  // is only destroyed by clearing the box below (legacy rows without the
  // flag fall back to the previous value-implies-enabled behaviour)
  const includePassword = prefs?.qr?.includePassword ?? !!prefs?.qr?.password
  const [hasInitialValue] = useState(() => !!prefs?.qr?.password)

  const handleSetPref = useCallback((update: Partial<IRoomPrefs>) => {
    onChange({ ...prefs, ...update })
  }, [onChange, prefs])

  useEffect(() => {
    if (includePassword && roomPasswordDirty && prefs?.qr?.password !== roomPassword) {
      handleSetPref({ qr: { ...prefs.qr, password: roomPassword } })
    }
  }, [handleSetPref, includePassword, prefs, roomPassword, roomPasswordDirty])

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
        {prefs?.qr?.isEnabled && roomPassword && !(hideIncludeUnlessValued && !hasInitialValue) && (
          <div className={styles.field}>
            <InputCheckbox
              label='Include room password'
              checked={includePassword}
              onChange={event => handleSetPref({ qr: { ...prefs.qr, includePassword: event.currentTarget.checked } })}
            />
          </div>
        )}
        {showPasswordBox && (
          <div className={styles.field}>
            <input
              type='password'
              autoComplete='new-password'
              value={prefs?.qr?.password ?? ''}
              onChange={e => handleSetPref({ qr: { ...prefs.qr, password: e.target.value } })}
              onFocus={e => e.target.select()}
              placeholder='password to embed in QR'
            />
          </div>
        )}
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
