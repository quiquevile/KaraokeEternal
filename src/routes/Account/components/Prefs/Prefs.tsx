import React from 'react'
import { useIntl } from 'react-intl'
import Panel from 'components/Panel/Panel'
import PathPrefs from './PathPrefs/PathPrefs'
import PlayerPrefs from './PlayerPrefs/PlayerPrefs'
import YouTubePrefs from './YouTubePrefs/YouTubePrefs'
import styles from './Prefs.css'

const Prefs = () => {
  const intl = useIntl()

  return (
    <Panel
      title={intl.formatMessage({ id: 'account.prefs.title', defaultMessage: 'Preferences' })}
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
