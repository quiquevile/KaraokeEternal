import React from 'react'
import { FormattedMessage } from 'react-intl'
import { Link } from 'react-router'
import styles from './NoPlayer.css'
import { headerMessages } from '../../messages'

const NoPlayer = () => (
  <div className={styles.container}>
    <p className={styles.msg}>
      <FormattedMessage
        {...headerMessages.text}
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
