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
import { accountMessages } from '../../messages'

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
        message = intl.formatMessage(accountMessages.signOutGuestSongs)
      } else if (user.isGuest) {
        message = intl.formatMessage(accountMessages.signOutGuest)
      } else if (hasUpcomingSongs) {
        message = intl.formatMessage(accountMessages.signOutSongs)
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
        alert(intl.formatMessage(accountMessages.needCurrentPassword))
        curPassword.current.focus()
        return
      }

      data.append('password', curPassword.current.value)
    }

    dispatch(updateAccount(data))
  }

  const guestLabel = intl.formatMessage(accountMessages.guest)

  return (
    <Panel
      title={intl.formatMessage(accountMessages.accountTitle)}
      contentClassName={styles.content}
    >
      <>
        <p>
          <FormattedMessage
            {...accountMessages.signedInAs}
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
              placeholder={intl.formatMessage(accountMessages.currentPassword)}
              ref={curPassword}
            />

          )}

          <div className={styles.btnContainer}>
            {isDirty && (
              <Button type='submit' variant='primary'>
                <FormattedMessage {...accountMessages.update} />
              </Button>
            )}
            <Button onClick={handleSignOut} variant='default'>
              <FormattedMessage {...accountMessages.signOut} />
            </Button>
          </div>
        </AccountForm>
      </>
    </Panel>
  )
}

export default Account
