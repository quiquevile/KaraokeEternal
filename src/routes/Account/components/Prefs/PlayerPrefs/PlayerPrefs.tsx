import React, { useState } from 'react'
import { useAppDispatch, useAppSelector } from 'store/hooks'
import Accordion from 'components/Accordion/Accordion'
import Button from 'components/Button/Button'
import Icon from 'components/Icon/Icon'
import { requestGainScan, setPref, type PlayerDisplayPrefs } from 'store/modules/prefs'
import { getPlayerDisplayPrefs } from 'routes/Player/lib/playerDisplay'
import styles from './PlayerPrefs.css'

const DISPLAY_FIELDS: { key: keyof PlayerDisplayPrefs, label: string }[] = [
  { key: 'nextUpLeadMs', label: 'Next singer lead time (ms)' },
  { key: 'upNowDurationMs', label: 'Current singer display time (ms)' },
  { key: 'pitchToastMs', label: 'Pitch display time (ms)' },
  { key: 'nextUpBlinkMs', label: 'Next singer blink time (ms)' },
]

const MsField = ({ fieldKey, label, value }: { fieldKey: keyof PlayerDisplayPrefs, label: string, value: number }) => {
  const [text, setText] = useState(String(value))
  const [prevValue, setPrevValue] = useState(value)
  const dispatch = useAppDispatch()
  const stored = useAppSelector(state => state.prefs.playerDisplay)

  if (value !== prevValue) {
    setPrevValue(value)
    setText(String(value))
  }

  const handleSave = () => {
    const parsed = Math.floor(Number(text))

    if (!Number.isFinite(parsed) || parsed < 0) {
      setText(String(value))
      return
    }

    if (parsed !== value) {
      dispatch(setPref({ key: 'playerDisplay', data: { ...getPlayerDisplayPrefs(stored), [fieldKey]: parsed } }))
    }
  }

  return (
    <label className={styles.field}>
      <span className={styles.fieldLabel}>{label}</span>
      <input
        type='number'
        min={0}
        step={100}
        value={text}
        onChange={e => setText(e.currentTarget.value)}
        onBlur={handleSave}
        onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
      />
    </label>
  )
}

const PlayerPrefs = () => {
  const isAdmin = useAppSelector(state => state.user.isAdmin)
  const isScanning = useAppSelector(state => state.prefs.isScanning)
  const displayPrefs = getPlayerDisplayPrefs(useAppSelector(state => state.prefs.playerDisplay))
  const dispatch = useAppDispatch()

  const handleGainScan = () => {
    dispatch(requestGainScan())
  }

  return (
    <Accordion
      className={styles.container}
      headingComponent={(
        <div className={styles.heading}>
          <Icon icon='TELEVISION_PLAY' size={32} className={styles.icon} />
          <div className={styles.title}>Player</div>
        </div>
      )}
    >
      <div className={styles.content}>
        {isAdmin && (
          <>
            <div className={styles.config}>
              {DISPLAY_FIELDS.map(({ key, label }) => (
                <MsField key={key} fieldKey={key} label={label} value={displayPrefs[key]} />
              ))}
            </div>
            <div>
              <Button onClick={handleGainScan} variant='default' disabled={isScanning}>
                Measure ReplayGain
              </Button>
            </div>
          </>
        )}
      </div>
    </Accordion>
  )
}

export default PlayerPrefs
