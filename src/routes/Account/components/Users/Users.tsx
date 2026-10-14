import React, { useEffect, useState } from 'react'
import { FormattedMessage, useIntl } from 'react-intl'
import { useAppDispatch, useAppSelector } from 'store/hooks'
import { closeUserEditor, fetchUsers, filterByOnline, filterByRoom, openUserEditor, type UserWithRoomsAndRole } from '../../modules/users'
import { formatDateTime } from 'lib/dateTime'
import Panel from 'components/Panel/Panel'
import Button from 'components/Button/Button'
import EditUser from './EditUser/EditUser'
import getUsers from '../../selectors/getUsers'
import styles from './Users.css'

const Users = () => {
  const [editorUser, setEditorUser] = useState<UserWithRoomsAndRole | null>(null)
  const intl = useIntl()

  const curUserId = useAppSelector(state => state.user.userId)
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

  // once per mount
  useEffect(() => {
    dispatch(fetchUsers())
  }, [dispatch])

  const rows = users.result.map((userId) => {
    const user = users.entities[userId]

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
          {user.role === 'admin' && intl.formatMessage({ id: 'account.form.roleAdmin', defaultMessage: 'Administrator' })}
          {user.role === 'standard' && intl.formatMessage({ id: 'account.form.roleStandard', defaultMessage: 'Standard' })}
          {user.role === 'guest' && intl.formatMessage({ id: 'account.form.roleGuest', defaultMessage: 'Guest' })}
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
      <option key='all' value='all'>{intl.formatMessage({ id: 'account.users.filterAll', defaultMessage: 'All' })}</option>
      <option key='online' value='online'>{intl.formatMessage({ id: 'account.users.filterOnline', defaultMessage: 'Online' })}</option>
      <optgroup label={intl.formatMessage({ id: 'account.users.filterOnlineIn', defaultMessage: 'Online in...' })}>
        {roomOpts}
      </optgroup>
    </select>
  )

  return (
    <Panel
      title={intl.formatMessage({ id: 'account.users.title', defaultMessage: 'Users' })}
      titleComponent={userFilter}
    >
      <>
        <table className={styles.table}>
          <thead>
            <tr>
              <th><FormattedMessage id='account.users.username' defaultMessage='Username' /></th>
              <th><FormattedMessage id='account.users.role' defaultMessage='Role' /></th>
              <th><FormattedMessage id='account.users.joined' defaultMessage='Joined' /></th>
            </tr>
          </thead>
          <tbody>
            {rows}
          </tbody>
        </table>

        <br />
        <Button onClick={handleOpen} variant='primary'>
          <FormattedMessage id='account.users.createUser' defaultMessage='Create User' />
        </Button>

        {isEditorOpen && (
          <EditUser onClose={handleClose} user={editorUser} />
        )}
      </>
    </Panel>
  )
}

export default Users
