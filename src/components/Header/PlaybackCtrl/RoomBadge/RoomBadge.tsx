import React from 'react'
import { FormattedMessage } from 'react-intl'
import { useAppSelector } from 'store/hooks'
import { Link } from 'react-router'
import styles from './RoomBadge.css'
import { headerMessages } from '../../messages'

// current room badge for admins (mirrors the NoPlayer notice styling):
// clicking it goes to /account to switch rooms
const RoomBadge = () => {
  const isAdmin = useAppSelector(state => state.user.isAdmin)
  const roomId = useAppSelector(state => state.user.roomId)
  const roomName = useAppSelector(state =>
    (typeof roomId === 'number' ? state.rooms.entities[roomId]?.name : undefined),
  )

  if (!isAdmin || typeof roomId !== 'number' || !roomName) return null

  return (
    <div className={styles.container}>
      <p className={styles.msg}>
        <Link to='/account'>
          <FormattedMessage {...headerMessages.roomBadge} values={{ name: roomName }} />
        </Link>
      </p>
    </div>
  )
}

export default RoomBadge
