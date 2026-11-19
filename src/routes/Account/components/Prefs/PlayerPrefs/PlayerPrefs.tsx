import React, { useState } from 'react'
import { FormattedMessage, useIntl } from 'react-intl'
import { useAppDispatch, useAppSelector } from 'store/hooks'
import Accordion from 'components/Accordion/Accordion'
import Icon from 'components/Icon/Icon'
import InputCheckbox from 'components/InputCheckbox/InputCheckbox'
import { setPref, type PlayerDisplayPrefs } from 'store/modules/prefs'
import { getPlayerDisplayPrefs } from 'routes/Player/lib/playerDisplay'
import styles from './PlayerPrefs.css'
import { accountMessages } from '../../../messages'

const DISPLAY_FIELDS: { key: keyof PlayerDisplayPrefs, message: (typeof accountMessages)[keyof typeof accountMessages] }[] = [
  { key: 'upNowDurationMs', message: accountMessages.playerPrefsUpNow },
  { key: 'nextUpLeadMs', message: accountMessages.playerPrefsLead },
  { key: 'nextUpBlinkMs', message: accountMessages.playerPrefsBlink },
  { key: 'pitchToastMs', message: accountMessages.playerPrefsToast },
]

const MsField = ({ fieldKey, message, value }: {
  fieldKey: keyof PlayerDisplayPrefs
  message: (typeof accountMessages)[keyof typeof accountMessages]
  value: number
}) => {
  const [text, setText] = useState(String(value))
  const [prevValue, setPrevValue] = useState(value)
  const dispatch = useAppDispatch()
  const stored = useAppSelector(state => state.prefs.playerDisplay)
  const intl = useIntl()

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
      <span className={styles.fieldLabel}>
        {intl.formatMessage(message)}
      </span>
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
  const isReplayGainEnabled = useAppSelector(state => state.prefs.isReplayGainEnabled)
  const displayPrefs = getPlayerDisplayPrefs(useAppSelector(state => state.prefs.playerDisplay))
  const dispatch = useAppDispatch()
  const intl = useIntl()

  const handleReplayGainChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    dispatch(setPref({ key: 'isReplayGainEnabled', data: e.currentTarget.checked }))
  }

  return (
    <Accordion
      className={styles.container}
      renderHeading={button => <div className={styles.heading}>{button}</div>}
      heading={(
        <>
          <Icon icon='TELEVISION_PLAY' size={32} className={styles.icon} />
          <div className={styles.title}>
            <FormattedMessage {...accountMessages.playerPrefsTitle} />
          </div>
        </>
      )}
    >
      <div className={styles.content}>
        {isAdmin && (
          <>
            <div className={styles.config}>
              {DISPLAY_FIELDS.map(({ key, message }) => (
                <MsField key={key} fieldKey={key} message={message} value={displayPrefs[key]} />
              ))}
            </div>
            <div>
              <InputCheckbox
                label={intl.formatMessage(accountMessages.replayGain)}
                checked={isReplayGainEnabled}
                onChange={handleReplayGainChange}
                aria-describedby='isReplayGainEnabled-desc'
              />
              <p id='isReplayGainEnabled-desc' className={styles.description}>
                <FormattedMessage {...accountMessages.replayGainDesc} />
              </p>
            </div>
          </>
        )}
      </div>
    </Accordion>
  )
}

export default PlayerPrefs
