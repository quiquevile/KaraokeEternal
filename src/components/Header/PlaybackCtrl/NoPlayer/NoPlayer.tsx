import React from 'react'
import { FormattedMessage } from 'react-intl'
import { Link } from 'react-router'
import styles from './NoPlayer.css'

const NoPlayer = () => (
  <div className={styles.container}>
    <p className={styles.msg}>
      <FormattedMessage
        id='noPlayer.text'
        defaultMessage='No player in room (<link>Launch Player</link>)'
        values={{
          link: chunks => (
            <Link to='/player' target='_blank' replace>
              {chunks}
            </Link>
          ),
        }}
      />
    </p>
  </div>
)

export default NoPlayer
