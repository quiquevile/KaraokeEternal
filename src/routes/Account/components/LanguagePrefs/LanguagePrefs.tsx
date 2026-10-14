import React from 'react'
import { useIntl } from 'react-intl'
import { useAppDispatch, useAppSelector } from 'store/hooks'
import { requestLocale } from 'store/modules/ui'
import { SUPPORTED_LOCALES, type LocaleCode } from 'lib/intl'
import Panel from 'components/Panel/Panel'
import styles from './LanguagePrefs.css'
import { commonMessages } from '../../../../lib/messages'

// per-device UI language, above everything else in account:
// one room, many languages
const LanguagePrefs = () => {
  const locale = useAppSelector(state => state.ui.locale)
  const dispatch = useAppDispatch()
  const intl = useIntl()

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    dispatch(requestLocale(e.currentTarget.value as LocaleCode))
  }

  return (
    <Panel
      title={intl.formatMessage(commonMessages.language)}
      contentClassName={styles.content}
    >
      <select
        value={locale}
        onChange={handleChange}
        aria-label={intl.formatMessage(commonMessages.language)}
      >
        {SUPPORTED_LOCALES.map(({ code, label }) => (
          <option key={code} value={code}>{label}</option>
        ))}
      </select>
    </Panel>
  )
}

export default LanguagePrefs
