import React from 'react'
import { FormattedMessage, useIntl } from 'react-intl'
import { useAppDispatch } from 'store/hooks'
import { createUser, removeUser, updateUser } from '../../../modules/users'
import Button from 'components/Button/Button'
import Modal from 'components/Modal/Modal'
import AccountForm from '../../AccountForm/AccountForm'
import { UserWithRole } from 'shared/types'
import styles from './EditUser.css'

interface EditUserProps {
  user?: UserWithRole
  onClose: () => void
}

const EditUser = ({ user, onClose }: EditUserProps) => {
  const dispatch = useAppDispatch()
  const intl = useIntl()

  const handleSubmit = (data: FormData) => {
    if (user) dispatch(updateUser({ userId: user.userId, data }))
    else dispatch(createUser(data))
  }

  const handleRemoveClick = () => {
    if (user && confirm(intl.formatMessage({
      id: 'account.editUser.removeConfirm',
      defaultMessage: 'Remove user "{username}"?\n\nTheir queued songs will also be removed.',
    }, { username: user.username }))) {
      dispatch(removeUser(user.userId))
    }
  }

  return (
    <Modal
      className={styles.modal}
      onClose={onClose}
      title={user
        ? user.username
        : intl.formatMessage({ id: 'account.editUser.createUser', defaultMessage: 'Create User' })}
    >
      <AccountForm user={user} onSubmit={handleSubmit} showRole autoFocus={!user}>
        <div className={styles.btnContainer}>
          {!user && (
            <Button type='submit' className={styles.btn} variant='primary'>
              <FormattedMessage id='account.editUser.createUser' defaultMessage='Create User' />
            </Button>
          )}

          {user && (
            <Button type='submit' className={styles.btn} variant='primary'>
              <FormattedMessage id='account.editUser.updateUser' defaultMessage='Update User' />
            </Button>
          )}

          {user && (
            <Button onClick={handleRemoveClick} className={styles.btn} variant='danger'>
              <FormattedMessage id='account.editUser.removeUser' defaultMessage='Remove User' />
            </Button>
          )}

          <Button onClick={onClose} variant='default'>
            <FormattedMessage id='account.editUser.cancel' defaultMessage='Cancel' />
          </Button>
        </div>
      </AccountForm>
    </Modal>
  )
}

export default EditUser
