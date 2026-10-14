import React from 'react'
import clsx from 'clsx'
import { FormattedMessage } from 'react-intl'
import { formatSeconds } from 'lib/dateTime'
import styles from './UpNext.css'
import { headerMessages } from '../messages'

interface UpNextProps {
  isUpNow: boolean
  isUpNext: boolean
  wait?: number
}

const strong = (chunks: React.ReactNode) => <strong>{chunks}</strong>

const UpNext = (props: UpNextProps) => {
  if (props.isUpNow) {
    return (
      <div className={clsx(styles.container, styles.upNow)}>
        <p className={styles.msg}>
          <FormattedMessage
            {...headerMessages.now}
            values={{ strong }}
          />
        </p>
      </div>
    )
  }

  if (props.isUpNext) {
    return (
      <div className={clsx(styles.container, styles.upNext)}>
        <p className={styles.msg}>
          {props.wait
            ? (
                <FormattedMessage
                  {...headerMessages.nextIn}
                  values={{ strong, wait: formatSeconds(props.wait, true) }}
                />
              )
            : (
                <FormattedMessage
                  {...headerMessages.next}
                  values={{ strong }}
                />
              )}
        </p>
      </div>
    )
  }

  if (props.wait) {
    return (
      <div className={clsx(styles.container, styles.inQueue)}>
        <p className={styles.msg}>
          <FormattedMessage
            {...headerMessages.in}
            values={{ wait: formatSeconds(props.wait, true) }}
          />
        </p>
      </div>
    )
  }

  return null
}

export default UpNext
