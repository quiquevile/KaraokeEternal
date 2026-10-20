import React, { useEffect, useState } from 'react'
import { FormattedMessage, useIntl } from 'react-intl'
import { useAppDispatch, useAppSelector } from 'store/hooks'
import { cleanupUsers, closeUserEditor, fetchUsers, filterByOnline, filterByRoom, openUserEditor, type UserWithRoomsAndRole } from '../../modules/users'
import { formatDateTime } from 'lib/dateTime'
import Panel from 'components/Panel/Panel'
import Button from 'components/Button/Button'
import EditUser from './EditUser/EditUser'
import getUsers from '../../selectors/getUsers'
import styles from './Users.css'
import { accountMessages } from '../../messages'
import { commonMessages } from '../../../../lib/messages'

const Users = () => {
  const [editorUser, setEditorUser] = useState<UserWithRoomsAndRole | null>(null)
  const intl = useIntl()

  const curUserId = useAppSelector(state => state.user.userId)
  const isAdmin = useAppSelector(state => state.user.isAdmin)
  const { isEditorOpen, filterOnline, filterRoomId } = useAppSelector(state => state.users)
  const rooms = useAppSelector(state => state.rooms)
  const users = useAppSelector(getUsers)

  const dispatch = useAppDispatch()
  const handleClose = () => dispatch(closeUserEditor())
  const handleFilterChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    if (e.target.value === 'all') dispatch(filterByOnline(false))
    else if (e.target.value === 'online') dispatch(filterByOnline(true))
    else dispatch(filterByRoom(parseInt(e.target.value, 10)))
  }

  const handleOpen = (e: React.MouseEvent<HTMLElement>) => {
    setEditorUser(users.entities[parseInt(e.currentTarget.dataset.userId)])
    dispatch(openUserEditor())
  }

  const handleCleanup = () => {
    if (window.confirm(intl.formatMessage(accountMessages.usersCleanupConfirm))) {
      dispatch(cleanupUsers())
    }
  }

  // once per mount
  useEffect(() => {
    dispatch(fetchUsers())
  }, [dispatch])

  const rows = users.result.map((userId) => {
    const user = users.entities[userId]

    // ghosts show their visible name only, indented below their creator
    if (user.role === 'ghost') {
      return (
        <tr key={userId}>
          <td className={styles.ghostCell}>
            <a data-user-id={userId} onClick={handleOpen}>{user.name}</a>
          </td>
          <td>{intl.formatMessage(accountMessages.roleGhost)}</td>
          <td>{formatDateTime(new Date(user.dateCreated * 1000))}</td>
        </tr>
      )
    }

    return (
      <tr key={userId}>
        {userId === curUserId && (
          <td translate='no'>
            <strong>{user.username}</strong>
            {/* eslint-disable formatjs/no-literal-string-in-jsx -- punctuation around data, not prose */}
            {' '}
            (
            {user.name}
            )
            {/* eslint-enable formatjs/no-literal-string-in-jsx */}
          </td>
        )}
        {userId !== curUserId && (
          <td>
            <a data-user-id={userId} onClick={handleOpen}>{user.username}</a>
            {/* eslint-disable formatjs/no-literal-string-in-jsx -- punctuation around data, not prose */}
            {' '}
            (
            {user.name}
            )
            {/* eslint-enable formatjs/no-literal-string-in-jsx */}
          </td>
        )}
        <td>
          {user.role === 'admin' && intl.formatMessage(accountMessages.roleAdmin)}
          {user.role === 'standard' && intl.formatMessage(accountMessages.roleStandard)}
          {user.role === 'guest' && intl.formatMessage(commonMessages.guest)}
          {!['admin', 'standard', 'guest'].includes(user.role) && user.role}
        </td>
        <td>{formatDateTime(new Date(user.dateCreated * 1000))}</td>
      </tr>
    )
  })

  const roomOpts = rooms.result
    .filter(roomId => !!rooms.entities[roomId].numUsers)
    .map(roomId => <option key={roomId} value={roomId}>{rooms.entities[roomId].name}</option>)

  const userFilter = (
    <select className={styles.usersFilter} onChange={handleFilterChange} value={filterOnline ? 'online' : filterRoomId || 'all'}>
      <option key='all' value='all'>{intl.formatMessage(accountMessages.filterAll2)}</option>
      <option key='online' value='online'>{intl.formatMessage(accountMessages.filterOnline)}</option>
      <optgroup label={intl.formatMessage(accountMessages.filterOnlineIn)}>
        {roomOpts}
      </optgroup>
    </select>
  )

  return (
    <Panel
      title={intl.formatMessage(commonMessages.users)}
      titleComponent={isAdmin ? userFilter : undefined}
    >
      <>
        <table className={styles.table}>
          <thead>
            <tr>
              <th><FormattedMessage {...accountMessages.username} /></th>
              <th><FormattedMessage {...accountMessages.role} /></th>
              <th><FormattedMessage {...accountMessages.joined} /></th>
            </tr>
          </thead>
          <tbody>
            {rows}
          </tbody>
        </table>

        <div className={styles.btnContainer}>
          {isAdmin && (
            <Button onClick={handleCleanup} variant='default'>
              <FormattedMessage {...accountMessages.usersCleanup} />
            </Button>
          )}
          <Button onClick={handleOpen} variant='primary'>
            <FormattedMessage {...commonMessages.createUser} />
          </Button>
        </div>

        {isEditorOpen && (
          <EditUser onClose={handleClose} user={editorUser} />
        )}
      </>
    </Panel>
  )
}

export default Users
