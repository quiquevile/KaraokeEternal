import React, { useState, useEffect, useRef } from 'react'
import { CSSTransition } from 'react-transition-group'
import UserImage from 'components/UserImage/UserImage'
import type { QueueItem } from 'shared/types'
import styles from './UpNow.css'

interface UpNowProps {
  queueItem: QueueItem
  displayMs: number
}

const UpNow = ({ queueItem, displayMs }: UpNowProps) => {
  const [show, setShow] = useState(false)
  const timeoutIdRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const nodeRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (timeoutIdRef.current) {
      clearTimeout(timeoutIdRef.current)
    }

    requestAnimationFrame(() => {
      setShow(true)
    })

    timeoutIdRef.current = setTimeout(() => {
      setShow(false)
    }, displayMs)

    // Cleanup the timeout when component unmounts or queueItem changes
    return () => {
      if (timeoutIdRef.current) {
        clearTimeout(timeoutIdRef.current)
      }
    }
  }, [queueItem.queueId, displayMs])

  return (
    <CSSTransition
      nodeRef={nodeRef}
      in={show}
      timeout={500}
      classNames={{
        enterActive: styles.enterActive,
        enterDone: styles.enterDone,
        exitActive: styles.exitActive,
      }}
    >
      <div ref={nodeRef} className={styles.container} translate='no'>
        <div className={styles.innerContainer}>
          <UserImage
            userId={queueItem.userId}
            dateUpdated={queueItem.userDateUpdated}
            className={styles.userImage}
          />
          <div className={styles.user}>
            {queueItem.userDisplayName}
          </div>
        </div>
      </div>
    </CSSTransition>
  )
}

export default UpNow
