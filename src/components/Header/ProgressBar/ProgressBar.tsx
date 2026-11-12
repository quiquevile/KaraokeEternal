import React, { useState } from 'react'
import { useIntl } from 'react-intl'
import Button from 'components/Button/Button'
import styles from './ProgressBar.css'
import { headerMessages } from '../messages'
import { commonMessages } from '../../../lib/messages'
import { sharedMessages } from '../../../components/messages'

interface ProgressBarProps {
  isActive: boolean
  onCancel: () => void
  pct: number
  text: string
}

const ProgressBar = ({ isActive, onCancel, pct, text }: ProgressBarProps) => {
  const intl = useIntl()
  const [canceling, setCanceling] = useState(false)
  const [visible, setVisible] = useState(false)
  const [prevActive, setPrevActive] = useState(isActive)
  const [prevText, setPrevText] = useState(text)

  if (isActive !== prevActive || text !== prevText) {
    setPrevActive(isActive)
    setPrevText(text)

    if (isActive && !prevActive) {
      setVisible(true)
      setCanceling(false)
    } else if (canceling && text !== prevText) {
      // only show 'Stopping...' until the next update
      setCanceling(false)
    }
  }

  const handleCancelClick = () => {
    if (isActive && !canceling) {
      setCanceling(true)
      onCancel()
    } else {
      setVisible(false)
    }
  }

  if (!visible) return null

  return (
    <div className={styles.container} style={{ backgroundSize: pct + '% 100%' }}>
      <p className={styles.text}>
        {canceling
          ? intl.formatMessage(headerMessages.stopping)
          : text}
      </p>
      <Button
        className={isActive ? styles.cancel : styles.close}
        icon='CLEAR'
        onClick={handleCancelClick}
        size={40}
        aria-label={intl.formatMessage(isActive ? commonMessages.cancel : sharedMessages.close)}
      />
    </div>
  )
}

export default ProgressBar
