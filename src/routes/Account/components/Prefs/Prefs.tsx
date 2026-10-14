import React from 'react'
import { useIntl } from 'react-intl'
import Panel from 'components/Panel/Panel'
import PathPrefs from './PathPrefs/PathPrefs'
import PlayerPrefs from './PlayerPrefs/PlayerPrefs'
import YouTubePrefs from './YouTubePrefs/YouTubePrefs'
import styles from './Prefs.css'
import { accountMessages } from '../../messages'

const Prefs = () => {
  const intl = useIntl()

  return (
    <Panel
      title={intl.formatMessage(accountMessages.prefsTitle)}
      contentClassName={styles.content}
    >
      <>
        <PathPrefs />
        <PlayerPrefs />
        <YouTubePrefs />
      </>
    </Panel>
  )
}

export default Prefs
