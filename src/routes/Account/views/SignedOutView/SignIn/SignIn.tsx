import React from 'react'
import { FormattedMessage, useIntl } from 'react-intl'
import Button from 'components/Button/Button'
import styles from './SignIn.css'
import { accountMessages } from '../../../messages'
import { commonMessages } from '../../../../../lib/messages'

interface SignInProps {
  username: string
  password: string
  onUsernameChange: (username: string) => void
  onPasswordChange: (password: string) => void
  onSubmit: (e: React.FormEvent) => void
  onFirstFieldRef: (el: HTMLInputElement | null) => void
}

const SignIn = ({
  username,
  password,
  onUsernameChange,
  onPasswordChange,
  onSubmit,
  onFirstFieldRef,
}: SignInProps) => {
  const intl = useIntl()

  return (
    <form noValidate onSubmit={onSubmit} className={styles.container}>
      <input
        type='email'
        autoComplete='username'
        placeholder={intl.formatMessage(commonMessages.usernameOrEmail)}
        value={username}
        onChange={e => onUsernameChange(e.target.value)}
        ref={onFirstFieldRef}
      />
      <input
        type='password'
        autoComplete='current-password'
        placeholder={intl.formatMessage(commonMessages.password)}
        value={password}
        onChange={e => onPasswordChange(e.target.value)}
      />
      <Button type='submit' variant='primary'>
        <FormattedMessage {...accountMessages.submit} />
      </Button>
    </form>
  )
}

export default SignIn
