import React, { useEffect, useState } from 'react'
import { FormattedMessage, useIntl } from 'react-intl'
import { useAppDispatch, useAppSelector } from 'store/hooks'
import { formatDateTime } from 'lib/dateTime'
import Panel from 'components/Panel/Panel'
import Button from 'components/Button/Button'
import EditRoom from './EditRoom/EditRoom'
import { closeRoomEditor, fetchRooms, filterByStatus, openRoomEditor } from 'store/modules/rooms'
import { filterByRoom } from '../../modules/users'
import getRoomList from '../../selectors/getRoomList'
import styles from './Rooms.css'

const Rooms = () => {
  const [editorRoom, setEditorRoom] = useState(null)
  const intl = useIntl()

  const { isEditorOpen, filterStatus } = useAppSelector(state => state.rooms)
  const rooms = useAppSelector(getRoomList)

  const dispatch = useAppDispatch()
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
          {room.status === 'open' && intl.formatMessage({ id: 'account.rooms.statusOpen', defaultMessage: 'Open' })}
          {room.status === 'closed' && intl.formatMessage({ id: 'account.rooms.statusClosed', defaultMessage: 'Closed' })}
          {room.status !== 'open' && room.status !== 'closed' && room.status}
          {room.numUsers > 0 && (
            <>
&nbsp;
              <a data-room-id={roomId} onClick={handleFilterUsers}>
                (
                {room.numUsers}
                )
              </a>
            </>
          )}
        </td>
        <td>{formatDateTime(new Date(room.dateCreated * 1000))}</td>
      </tr>
    )
  })

  const roomsFilter = (
    <select className={styles.roomsFilter} onChange={handleFilterChange} value={filterStatus === false ? 'all' : filterStatus as string}>
      <option key='all' value='all'>{intl.formatMessage({ id: 'account.rooms.filterAll', defaultMessage: 'All' })}</option>
      <option key='open' value='open'>{intl.formatMessage({ id: 'account.rooms.filterOpen', defaultMessage: 'Open' })}</option>
      <option key='closed' value='closed'>{intl.formatMessage({ id: 'account.rooms.filterClosed', defaultMessage: 'Closed' })}</option>
    </select>
  )

  return (
    <Panel
      title={intl.formatMessage({ id: 'account.rooms.title', defaultMessage: 'Rooms' })}
      titleComponent={roomsFilter}
    >
      <>
        <table className={styles.table}>
          <thead>
            <tr>
              <th><FormattedMessage id='account.rooms.name' defaultMessage='Name' /></th>
              <th><FormattedMessage id='account.rooms.status' defaultMessage='Status' /></th>
              <th><FormattedMessage id='account.rooms.created' defaultMessage='Created' /></th>
            </tr>
          </thead>
          <tbody>
            {rows}
          </tbody>
        </table>

        <br />
        <Button onClick={handleOpen} variant='primary'>
          <FormattedMessage id='account.rooms.createRoom' defaultMessage='Create Room' />
        </Button>

        {isEditorOpen && <EditRoom onClose={handleClose} room={editorRoom} />}
      </>
    </Panel>
  )
}

export default Rooms
