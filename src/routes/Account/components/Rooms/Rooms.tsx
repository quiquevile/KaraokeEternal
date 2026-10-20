import React, { useEffect, useState } from 'react'
import { FormattedMessage, useIntl } from 'react-intl'
import { useNavigate } from 'react-router'
import { useAppDispatch, useAppSelector } from 'store/hooks'
import { switchRoom } from 'store/modules/user'
import { formatDateTime } from 'lib/dateTime'
import Panel from 'components/Panel/Panel'
import Button from 'components/Button/Button'
import EditRoom from './EditRoom/EditRoom'
import { cleanupRooms, closeRoomEditor, fetchRooms, filterByStatus, openRoomEditor } from 'store/modules/rooms'
import { filterByRoom } from '../../modules/users'
import getRoomList from '../../selectors/getRoomList'
import { accountMessages } from '../../messages'
import { commonMessages } from '../../../../lib/messages'
import styles from './Rooms.css'

const Rooms = () => {
  const [editorRoom, setEditorRoom] = useState(null)
  const intl = useIntl()

  const { isEditorOpen, filterStatus } = useAppSelector(state => state.rooms)
  const rooms = useAppSelector(getRoomList)

  const dispatch = useAppDispatch()
  const navigate = useNavigate()
  const handleClose = () => dispatch(closeRoomEditor())
  const handleFilterChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    if (e.currentTarget.value === 'all') dispatch(filterByStatus(false))
    else dispatch(filterByStatus(e.currentTarget.value))
  }
  const handleFilterUsers = (e: React.MouseEvent<HTMLElement>) => dispatch(filterByRoom(parseInt(e.currentTarget.dataset.roomId)))
  const handleOpen = (e: React.MouseEvent<HTMLElement>) => {
    setEditorRoom(rooms.entities[parseInt(e.currentTarget.dataset.roomId || '0')])
    dispatch(openRoomEditor())
  }
  const handleSwitchRoom = (roomId: number) => {
    dispatch(switchRoom(roomId))
    navigate('/queue')
  }
  const handleCleanup = () => {
    if (window.confirm(intl.formatMessage(accountMessages.roomsCleanupConfirm))) {
      dispatch(cleanupRooms())
    }
  }

  // once per mount
  useEffect(() => {
    dispatch(fetchRooms())
  }, [dispatch])

  const rows = rooms.result.map((roomId) => {
    const room = rooms.entities[roomId]
    return (
      <tr key={String(roomId)}>
        <td translate='no'><a data-room-id={roomId} onClick={handleOpen}>{room.name}</a></td>
        <td>
          <a
            onClick={() => handleSwitchRoom(roomId)}
            aria-label={intl.formatMessage(accountMessages.switchTo, { name: room.name })}
          >
            {room.status === 'open' && intl.formatMessage(accountMessages.statusOpen)}
            {room.status === 'closed' && intl.formatMessage(accountMessages.statusClosed)}
            {room.status !== 'open' && room.status !== 'closed' && room.status}
          </a>
          {room.numUsers > 0 && (
            <>
&nbsp;
              <a data-room-id={roomId} onClick={handleFilterUsers}>
                {/* eslint-disable formatjs/no-literal-string-in-jsx -- punctuation around a count, not prose */}
                (
                {room.numUsers}
                )
                {/* eslint-enable formatjs/no-literal-string-in-jsx */}
              </a>
            </>
          )}
        </td>
        <td>
          <a
            onClick={() => handleSwitchRoom(roomId)}
            aria-label={intl.formatMessage(accountMessages.switchTo, { name: room.name })}
          >
            {formatDateTime(new Date(room.dateCreated * 1000))}
          </a>
        </td>
      </tr>
    )
  })

  const roomsFilter = (
    <select className={styles.roomsFilter} onChange={handleFilterChange} value={filterStatus === false ? 'all' : filterStatus as string}>
      <option key='all' value='all'>{intl.formatMessage(accountMessages.filterAll)}</option>
      <option key='open' value='open'>{intl.formatMessage(accountMessages.filterOpen)}</option>
      <option key='closed' value='closed'>{intl.formatMessage(accountMessages.filterClosed)}</option>
    </select>
  )

  return (
    <Panel
      title={intl.formatMessage(accountMessages.roomsTitle)}
      titleComponent={roomsFilter}
    >
      <>
        <table className={styles.table}>
          <thead>
            <tr>
              <th><FormattedMessage {...accountMessages.roomsName} /></th>
              <th><FormattedMessage {...accountMessages.status} /></th>
              <th><FormattedMessage {...accountMessages.created} /></th>
            </tr>
          </thead>
          <tbody>
            {rows}
          </tbody>
        </table>

        <div className={styles.btnContainer}>
          <Button onClick={handleCleanup} variant='default'>
            <FormattedMessage {...accountMessages.roomsCleanup} />
          </Button>
          <Button onClick={handleOpen} variant='primary'>
            <FormattedMessage {...commonMessages.createRoom} />
          </Button>
        </div>

        {isEditorOpen && <EditRoom onClose={handleClose} room={editorRoom} />}
      </>
    </Panel>
  )
}

export default Rooms
