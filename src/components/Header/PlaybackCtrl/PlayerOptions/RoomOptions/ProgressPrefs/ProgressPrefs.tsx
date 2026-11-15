import React, { useCallback } from 'react'
import { useIntl } from 'react-intl'
import InputCheckbox from 'components/InputCheckbox/InputCheckbox'
import type { IRoomPrefs } from 'shared/types'
import { headerMessages } from '../../../../messages'
import styles from './ProgressPrefs.css'

interface ProgressPrefsProps {
  prefs: Partial<IRoomPrefs>
  onChange: (prefs: Partial<IRoomPrefs>) => void
}

// master switch on top: while off the player shows nothing of the readout
// and the element toggles below go inert but keep their state, so turning
// it back on restores the previous configuration. Each element still
// toggles on its own: the bar can be off while the text elements stay
const ProgressPrefs = ({ onChange, prefs = {} }: ProgressPrefsProps) => {
  const intl = useIntl()
  const isActive = prefs?.progress?.isActive ?? true

  const handleSetPref = useCallback((update: Partial<IRoomPrefs>) => {
    onChange({ ...prefs, ...update })
  }, [onChange, prefs])

  return (
    <fieldset>
      <legend>
        <label>{intl.formatMessage(headerMessages.progressInfo)}</label>
      </legend>
      <div>
        <InputCheckbox
          label={intl.formatMessage(headerMessages.progressEnable)}
          checked={isActive}
          onChange={event => handleSetPref({ progress: { ...prefs.progress, isActive: event.currentTarget.checked } })}
        />
      </div>
      <div className={styles.dependents}>
        <div>
          <InputCheckbox
            label={intl.formatMessage(headerMessages.showProgress)}
            checked={prefs?.progress?.isEnabled ?? true}
            disabled={!isActive}
            onChange={event => handleSetPref({ progress: { ...prefs.progress, isEnabled: event.currentTarget.checked } })}
          />
        </div>
        <div>
          <InputCheckbox
            label={intl.formatMessage(headerMessages.showProgressTitle)}
            checked={prefs?.progress?.showTitle ?? true}
            disabled={!isActive}
            onChange={event => handleSetPref({ progress: { ...prefs.progress, showTitle: event.currentTarget.checked } })}
          />
        </div>
        <div>
          <InputCheckbox
            label={intl.formatMessage(headerMessages.showProgressSinger)}
            checked={prefs?.progress?.showSinger ?? true}
            disabled={!isActive}
            onChange={event => handleSetPref({ progress: { ...prefs.progress, showSinger: event.currentTarget.checked } })}
          />
        </div>
        <div>
          <InputCheckbox
            label={intl.formatMessage(headerMessages.showProgressTime)}
            checked={prefs?.progress?.showTime ?? true}
            disabled={!isActive}
            onChange={event => handleSetPref({ progress: { ...prefs.progress, showTime: event.currentTarget.checked } })}
          />
        </div>
      </div>
    </fieldset>
  )
}

export default ProgressPrefs
