import React, { useRef, useState } from 'react'
import { FormattedMessage, useIntl } from 'react-intl'
import { useAppDispatch, useAppSelector } from 'store/hooks'
import { requestLogout, updateAccount } from 'store/modules/user'
import { removeItem } from 'routes/Queue/modules/queue'
import getUpcoming from 'routes/Queue/selectors/getUpcoming'
import Panel from 'components/Panel/Panel'
import Button from 'components/Button/Button'
import AccountForm from '../AccountForm/AccountForm'
import styles from './Account.css'

const Account = () => {
  const dispatch = useAppDispatch()
  const user = useAppSelector(state => state.user)
  const upcomingQueueIds = useAppSelector(state => getUpcoming(state, user.userId))
  const intl = useIntl()

  const curPassword = useRef(null)
  const [isDirty, setDirty] = useState(false)

  const handleSignOut = () => {
    if (!user.isAdmin) {
      const hasUpcomingSongs = upcomingQueueIds.length > 0
      let message: string | null = null

      if (user.isGuest && hasUpcomingSongs) {
        message = intl.formatMessage({
          id: 'account.account.signOutGuestSongs',
          defaultMessage: 'Are you sure you want to sign out?\n\nYour upcoming songs will be removed from the queue, and as a guest, you won\'t be able to sign back into this account.',
        })
      } else if (user.isGuest) {
        message = intl.formatMessage({
          id: 'account.account.signOutGuest',
          defaultMessage: 'Are you sure you want to sign out?\n\nAs a guest, you won\'t be able to sign back into this account.',
        })
      } else if (hasUpcomingSongs) {
        message = intl.formatMessage({
          id: 'account.account.signOutSongs',
          defaultMessage: 'Are you sure you want to sign out?\n\nYour upcoming songs will be removed from the queue.',
        })
      }

      if (message && !confirm(message)) return

      if (hasUpcomingSongs) {
        dispatch(removeItem({ queueId: upcomingQueueIds }))
      }
    }

    dispatch(requestLogout())
  }

  const handleSubmit = (data: FormData) => {
    if (!user.isGuest) {
      if (!curPassword.current.value.trim()) {
        alert(intl.formatMessage({
          id: 'account.account.needCurrentPassword',
          defaultMessage: 'Please enter your current password to make changes.',
        }))
        curPassword.current.focus()
        return
      }

      data.append('password', curPassword.current.value)
    }

    dispatch(updateAccount(data))
  }

  const guestLabel = intl.formatMessage({ id: 'account.account.guest', defaultMessage: 'guest' })

  return (
    <Panel
      title={intl.formatMessage({ id: 'account.account.title', defaultMessage: 'My Account' })}
      contentClassName={styles.content}
    >
      <>
        <p>
          <FormattedMessage
            id='account.account.signedInAs'
            defaultMessage='Signed in as <strong>{name}</strong>'
            values={{
              strong: chunks => <strong>{chunks}</strong>,
              name: user.isGuest ? guestLabel : user.username,
            }}
          />
        </p>

        <AccountForm
          user={user}
          onDirtyChange={setDirty}
          onSubmit={handleSubmit}
          showUsername={!user.isGuest}
          showPassword={!user.isGuest}
        >
          {isDirty && !user.isGuest && (
            <input
              type='password'
              autoComplete='current-password'
              placeholder={intl.formatMessage({ id: 'account.account.currentPassword', defaultMessage: 'current password' })}
              ref={curPassword}
            />

          )}

          <div className={styles.btnContainer}>
            {isDirty && (
              <Button type='submit' variant='primary'>
                <FormattedMessage id='account.account.update' defaultMessage='Update Account' />
              </Button>
            )}
            <Button onClick={handleSignOut} variant='default'>
              <FormattedMessage id='account.account.signOut' defaultMessage='Sign Out' />
            </Button>
          </div>
        </AccountForm>
      </>
    </Panel>
  )
}

export default Account
