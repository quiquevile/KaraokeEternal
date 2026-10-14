import React from 'react'
import { FormattedMessage, useIntl } from 'react-intl'
import { useAppDispatch } from 'store/hooks'
import { createUser, removeUser, updateUser } from '../../../modules/users'
import Button from 'components/Button/Button'
import Modal from 'components/Modal/Modal'
import AccountForm from '../../AccountForm/AccountForm'
import { UserWithRole } from 'shared/types'
import styles from './EditUser.css'
import { accountMessages } from '../../../messages'
import { commonMessages } from '../../../../../lib/messages'

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
    if (user && confirm(intl.formatMessage(accountMessages.removeConfirm2, { username: user.username }))) {
      dispatch(removeUser(user.userId))
    }
  }

  return (
    <Modal
      className={styles.modal}
      onClose={onClose}
      title={user
        ? user.username
        : intl.formatMessage(commonMessages.createUser)}
    >
      <AccountForm user={user} onSubmit={handleSubmit} showRole autoFocus={!user}>
        <div className={styles.btnContainer}>
          {!user && (
            <Button type='submit' className={styles.btn} variant='primary'>
              <FormattedMessage {...commonMessages.createUser} />
            </Button>
          )}

          {user && (
            <Button type='submit' className={styles.btn} variant='primary'>
              <FormattedMessage {...accountMessages.updateUser} />
            </Button>
          )}

          {user && (
            <Button onClick={handleRemoveClick} className={styles.btn} variant='danger'>
              <FormattedMessage {...accountMessages.removeUser} />
            </Button>
          )}

          <Button onClick={onClose} variant='default'>
            <FormattedMessage {...commonMessages.cancel} />
          </Button>
        </div>
      </AccountForm>
    </Modal>
  )
}

export default EditUser
