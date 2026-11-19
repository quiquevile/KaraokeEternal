import React from 'react'
import { useIntl } from 'react-intl'
import Panel from 'components/Panel/Panel'
import PathPrefs from './PathPrefs/PathPrefs'
import PlayerPrefs from './PlayerPrefs/PlayerPrefs'
import ProviderPrefs from './ProviderPrefs/ProviderPrefs'
import TagPrefs from './TagPrefs/TagPrefs'
import { useAppSelector } from 'store/hooks'
import styles from './Prefs.css'
import { accountMessages } from '../../messages'

const Prefs = () => {
  const intl = useIntl()
  const isAdmin = useAppSelector(state => state.user.isAdmin)

  return (
    <Panel
      title={intl.formatMessage(accountMessages.prefsTitle)}
      contentClassName={styles.content}
    >
      <>
        {isAdmin && <PathPrefs />}
        {isAdmin && <PlayerPrefs />}
        {isAdmin && <ProviderPrefs />}
        <TagPrefs />
      </>
    </Panel>
  )
}

export default Prefs
