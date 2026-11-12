import React, { useEffect, useRef, useState } from 'react'
import { useIntl } from 'react-intl'
import Accordion from 'components/Accordion/Accordion'
import InputCheckbox from 'components/InputCheckbox/InputCheckbox'
import InputImage from 'components/InputImage/InputImage'
import { PERMISSIONS } from './permissions'
import { Permission, UserWithRole } from 'shared/types'
import styles from './AccountForm.css'
import { accountMessages } from '../../messages'
import { commonMessages } from '../../../../lib/messages'

interface AccountFormProps {
  autoFocus?: boolean
  children?: React.ReactNode
  onDirtyChange?(isDirty: boolean): void
  onSubmit(formData: FormData): void
  showRole?: boolean
  showUsername?: boolean
  showPassword?: boolean
  user?: UserWithRole
}

const AccountForm = ({
  autoFocus,
  children,
  onDirtyChange,
  onSubmit,
  showRole,
  showUsername = true,
  showPassword = true,
  user,
}: AccountFormProps) => {
  const usernameRef = useRef<HTMLInputElement>(null)
  const newPasswordRef = useRef<HTMLInputElement>(null)
  const newPasswordConfirmRef = useRef<HTMLInputElement>(null)
  const nameRef = useRef<HTMLInputElement>(null)
  const roleRef = useRef<HTMLSelectElement>(null)
  const [prevDateUpdated, setPrevDateUpdated] = useState(user?.dateUpdated)
  const [state, setState] = useState({
    isDirty: false,
    isChangingPassword: !user || user.userId === null,
    userImage: undefined as Blob | undefined,
    perms: Object.fromEntries(
      PERMISSIONS.filter(p => user?.permissions?.[p.value]).map(p => [p.value, true]),
    ) as Record<string, boolean>,
  })

  const prevIsDirtyRef = useRef(state.isDirty)

  if (user && user.dateUpdated !== prevDateUpdated) {
    setPrevDateUpdated(user.dateUpdated)
    setState(prev => ({ ...prev, isDirty: false }))
  }

  useEffect(() => {
    if (onDirtyChange && prevIsDirtyRef.current !== state.isDirty) {
      onDirtyChange(state.isDirty)
    }

    prevIsDirtyRef.current = state.isDirty
  }, [state.isDirty, onDirtyChange])

  const [selectedRole, setSelectedRole] = useState(user?.role ?? '')
  const intl = useIntl()
  const isSignedIn = user && user.userId !== null
  // ghost accounts get their username/password server-side when created
  const hideCredentials = !user && selectedRole === 'ghost'
  const showUsernameField = showUsername && !hideCredentials
  const showPasswordField = showPassword && !hideCredentials

  const updateDirty = (perms: Record<string, boolean> = state.perms) => {
    if (!user || user.userId === null) return

    const userPerms = user.permissions ?? {}
    const permsChanged = PERMISSIONS.some(p => !!perms[p.value] !== !!userPerms[p.value])

    setState(prev => ({
      ...prev,
      isDirty: (showUsernameField && !!usernameRef.current?.value)
        || (showPasswordField && !!newPasswordRef.current?.value)
        || (nameRef.current?.value !== user.name)
        || (roleRef.current && roleRef.current.value !== (user.role ?? ''))
        || permsChanged,
      isChangingPassword: showPasswordField && !!newPasswordRef.current?.value,
    }))
  }

  const handleUserImageChange = (blob: Blob) => {
    setState(prev => ({
      ...prev,
      userImage: blob,
      isDirty: true,
    }))
  }

  const handleTogglePerm = (value: Permission) => {
    const next = { ...state.perms, [value]: !state.perms[value] }

    // nested permissions live and die with their parent
    for (const p of PERMISSIONS) {
      if (p.parent === value && !next[value]) delete next[p.value]
    }

    const cleaned = Object.fromEntries(
      Object.entries(next).filter(([, v]) => v),
    )
    setState(prev => ({ ...prev, perms: cleaned }))
    updateDirty(cleaned)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const data = new FormData()

    if (nameRef.current?.value.trim()) {
      data.append('name', nameRef.current.value.trim())
    }

    if (showUsernameField && usernameRef.current?.value.trim()) {
      data.append('username', usernameRef.current.value.trim())
    }

    if (showPasswordField && state.isChangingPassword) {
      data.append('newPassword', newPasswordRef.current?.value || '')
      data.append('newPasswordConfirm', newPasswordConfirmRef.current?.value || '')
    }

    if (typeof state.userImage !== 'undefined') {
      data.append('image', state.userImage)
    }

    if (roleRef.current) {
      data.append('role', roleRef.current.value)
    }

    if (showRole && selectedRole !== 'admin' && selectedRole !== 'guest' && selectedRole !== 'ghost') {
      data.append('permissions', JSON.stringify(state.perms))
    }

    onSubmit(data)
  }

  return (
    <form
      className={styles.container}
      key={user?.dateUpdated}
      noValidate
      onSubmit={handleSubmit}
    >
      {showUsernameField && (
        <input
          type='email'
          autoComplete='off'
          autoFocus={autoFocus}
          onChange={() => updateDirty()}
          placeholder={isSignedIn
            ? intl.formatMessage(accountMessages.changeUsername)
            : intl.formatMessage(commonMessages.username)}
          // https://github.com/facebook/react/issues/23301
          ref={(r) => {
            if (r) usernameRef.current = r
            if (autoFocus) r?.setAttribute('autofocus', 'true')
          }}
        />
      )}

      {showPasswordField && (
        <input
          type='password'
          autoComplete='new-password'
          onChange={() => updateDirty()}
          placeholder={isSignedIn
            ? intl.formatMessage(accountMessages.changePassword)
            : intl.formatMessage(commonMessages.password)}
          ref={newPasswordRef}
        />
      )}

      {showPasswordField && state.isChangingPassword && (
        <input
          type='password'
          autoComplete='new-password'
          placeholder={isSignedIn
            ? intl.formatMessage(accountMessages.newPasswordConfirm)
            : intl.formatMessage(commonMessages.confirmPassword)}
          ref={newPasswordConfirmRef}
        />
      )}

      <div className={styles.userDisplayContainer}>
        <InputImage
          user={user}
          onSelect={handleUserImageChange}
        />
        <input
          type='text'
          autoFocus={autoFocus && !showUsernameField}
          defaultValue={user?.name ?? ''}
          onChange={() => updateDirty()}
          placeholder={intl.formatMessage(commonMessages.displayName)}
          ref={nameRef}
        />
      </div>

      {showRole && (
        <select
          defaultValue={user?.role}
          onChange={(e) => {
            setSelectedRole(e.target.value)
            updateDirty()
          }}
          ref={roleRef}
        >
          <option key='choose' value='' disabled>{intl.formatMessage(accountMessages.selectRole)}</option>
          {user?.role === 'guest' && <option key='guest' value='guest'>{intl.formatMessage(commonMessages.guest)}</option>}
          {(!user || user.role === 'ghost') && <option key='ghost' value='ghost'>{intl.formatMessage(accountMessages.roleGhost)}</option>}
          <option key='standard' value='standard'>{intl.formatMessage(accountMessages.roleStandard)}</option>
          <option key='admin' value='admin'>{intl.formatMessage(accountMessages.roleAdmin)}</option>
        </select>
      )}

      {showRole && selectedRole !== 'admin' && selectedRole !== 'guest' && selectedRole !== 'ghost' && (
        <Accordion
          renderHeading={button => <div className={styles.permsHeading}>{button}</div>}
          heading={(
            <div className={styles.permsTitle}>
              {intl.formatMessage(accountMessages.permissions)}
            </div>
          )}
        >
          <div className={styles.permsContent}>
            {PERMISSIONS.map(p => (
              <div key={p.value} className={p.parent ? styles.permsNested : undefined}>
                <InputCheckbox
                  label={intl.formatMessage(p.message)}
                  checked={!!state.perms[p.value]}
                  disabled={!!p.parent && !state.perms[p.parent]}
                  onChange={() => handleTogglePerm(p.value)}
                />
              </div>
            ))}
          </div>
        </Accordion>
      )}

      {children}
    </form>
  )
}

export default AccountForm
