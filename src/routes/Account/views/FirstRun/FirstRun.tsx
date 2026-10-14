import React from 'react'
import { FormattedMessage } from 'react-intl'
import { useAppDispatch, useAppSelector } from 'store/hooks'
import { createAccount } from 'store/modules/user'
import Button from 'components/Button/Button'
import Logo from 'components/Logo/Logo'
import AccountForm from '../../components/AccountForm/AccountForm'
import styles from './FirstRun.css'
import { accountMessages } from '../../messages'

const FirstRun = () => {
  const ui = useAppSelector(state => state.ui)

  const dispatch = useAppDispatch()
  const handleCreate = (data: FormData) => {
    dispatch(createAccount(data))
  }

  return (
    <div className={styles.container} style={{ maxWidth: Math.max(340, ui.contentWidth * 0.66) }}>
      <Logo className={styles.logo} />
      <h1><FormattedMessage {...accountMessages.welcome} /></h1>
      <p>
        <FormattedMessage
          {...accountMessages.intro}
          values={{ b: chunks => <b>{chunks}</b> }}
        />
      </p>
      <AccountForm onSubmit={handleCreate} autoFocus>
        <Button variant='primary' type='submit'>
          <FormattedMessage {...accountMessages.createAccount} />
        </Button>
      </AccountForm>
    </div>

  )
}

export default FirstRun
