import React, { useEffect } from 'react'
import { FormattedMessage } from 'react-intl'
import { useAppDispatch, useAppSelector } from 'store/hooks'
import { fetchRooms } from 'store/modules/rooms'
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
  const dispatch = useAppDispatch()

  // rooms load lazily per page: fetch when our own entry is missing
  useEffect(() => {
    if (isAdmin && typeof roomId === 'number' && !roomName) {
      dispatch(fetchRooms())
    }
  }, [dispatch, isAdmin, roomId, roomName])

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
