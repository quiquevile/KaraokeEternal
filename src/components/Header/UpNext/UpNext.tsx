import React from 'react'
import clsx from 'clsx'
import { FormattedMessage } from 'react-intl'
import { formatSeconds } from 'lib/dateTime'
import styles from './UpNext.css'

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
            id='header.upNext.now'
            defaultMessage="You're up <strong>now</strong>"
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
                  id='header.upNext.nextIn'
                  defaultMessage="You're up <strong>next</strong> in {wait}"
                  values={{ strong, wait: formatSeconds(props.wait, true) }}
                />
              )
            : (
                <FormattedMessage
                  id='header.upNext.next'
                  defaultMessage="You're up <strong>next</strong>"
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
            id='header.upNext.in'
            defaultMessage="You're up in {wait}"
            values={{ wait: formatSeconds(props.wait, true) }}
          />
        </p>
      </div>
    )
  }

  return null
}

export default UpNext
