import React, { useEffect, useRef, useState } from 'react'
import Button from 'components/Button/Button'
import InputImage from 'components/InputImage/InputImage'
import PermissionsDialog from './PermissionsDialog'
import { PERMISSIONS } from './permissions'
import { UserWithRole } from 'shared/types'
import styles from './AccountForm.css'

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
  const username = useRef<HTMLInputElement>(null)
  const newPassword = useRef<HTMLInputElement>(null)
  const newPasswordConfirm = useRef<HTMLInputElement>(null)
  const name = useRef<HTMLInputElement>(null)
  const role = useRef<HTMLSelectElement>(null)
  const [prevDateUpdated, setPrevDateUpdated] = useState(user?.dateUpdated)
  const [state, setState] = useState({
    isDirty: false,
    isChangingPassword: !user || user.userId === null,
    userImage: undefined as Blob | undefined,
    perms: Object.fromEntries(
      PERMISSIONS.filter(p => user?.permissions?.[p.value]).map(p => [p.value, true]),
    ) as Record<string, boolean>,
    permsOpen: false,
  })

  const prevIsDirty = useRef(state.isDirty)

  if (user && user.dateUpdated !== prevDateUpdated) {
    setPrevDateUpdated(user.dateUpdated)
    setState(prev => ({ ...prev, isDirty: false }))
  }

  useEffect(() => {
    if (onDirtyChange && prevIsDirty.current !== state.isDirty) {
      onDirtyChange(state.isDirty)
    }

    prevIsDirty.current = state.isDirty
  }, [state.isDirty, onDirtyChange])

  const [selectedRole, setSelectedRole] = useState(user?.role ?? '')

  const updateDirty = (perms: Record<string, boolean> = state.perms) => {
    if (!user || user.userId === null) return

    const userPerms = user.permissions ?? {}
    const permsChanged = PERMISSIONS.some(p => !!perms[p.value] !== !!userPerms[p.value])

    setState(prev => ({
      ...prev,
      isDirty: !!username.current?.value || !!newPassword.current?.value
        || (name.current?.value !== user.name)
        || (role.current && role.current.value !== (user.role ?? ''))
        || permsChanged,
      isChangingPassword: !!newPassword.current?.value,
    }))
  }

  const handleUserImageChange = (blob: Blob) => {
    setState(prev => ({
      ...prev,
      userImage: blob,
      isDirty: true,
    }))
  }

  const handleApplyPerms = (perms: Record<string, boolean>) => {
    const cleaned = Object.fromEntries(Object.entries(perms).filter(([, v]) => v))
    setState(prev => ({ ...prev, perms: cleaned, permsOpen: false }))
    updateDirty(cleaned)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const data = new FormData()

    if (name.current?.value.trim()) {
      data.append('name', name.current.value.trim())
    }

    if (username.current?.value.trim()) {
      data.append('username', username.current.value.trim())
    }

    if (state.isChangingPassword) {
      data.append('newPassword', newPassword.current?.value || '')
      data.append('newPasswordConfirm', newPasswordConfirm.current?.value || '')
    }

    if (typeof state.userImage !== 'undefined') {
      data.append('image', state.userImage)
    }

    if (role.current) {
      data.append('role', role.current.value)
    }

    if (showRole && selectedRole !== 'admin' && selectedRole !== 'guest') {
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
      {showUsername && (
        <input
          type='email'
          autoComplete='off'
          autoFocus={autoFocus}
          onChange={() => updateDirty()}
          placeholder={user && user.userId !== null ? 'change username (optional)' : 'username or email'}
          // https://github.com/facebook/react/issues/23301
          ref={(r) => {
            if (r) username.current = r
            if (autoFocus) r?.setAttribute('autofocus', 'true')
          }}
        />
      )}

      {showPassword && (
        <input
          type='password'
          autoComplete='new-password'
          onChange={() => updateDirty()}
          placeholder={user && user.userId !== null ? 'change password (optional)' : 'password'}
          ref={newPassword}
        />
      )}

      {state.isChangingPassword && (
        <input
          type='password'
          autoComplete='new-password'
          placeholder={user && user.userId !== null ? 'new password confirm' : 'confirm password'}
          ref={newPasswordConfirm}
        />
      )}

      <div className={styles.userDisplayContainer}>
        <InputImage
          user={user}
          onSelect={handleUserImageChange}
        />
        <input
          type='text'
          defaultValue={user?.name ?? ''}
          onChange={() => updateDirty()}
          placeholder='display name'
          ref={name}
        />
      </div>

      {showRole && (
        <select
          defaultValue={user?.role}
          onChange={(e) => {
            setSelectedRole(e.target.value)
            updateDirty()
          }}
          ref={role}
        >
          <option key='choose' value='' disabled>select role...</option>
          {user?.role === 'guest' && <option key='guest' value='guest'>Guest</option>}
          <option key='standard' value='standard'>Standard</option>
          <option key='admin' value='admin'>Administrator</option>
        </select>
      )}

      {showRole && selectedRole !== 'admin' && selectedRole !== 'guest' && (
        <>
          <Button
            className={styles.permsBtn}
            onClick={() => setState(prev => ({ ...prev, permsOpen: true }))}
            aria-haspopup='dialog'
          >
            Permissions
          </Button>
          <PermissionsDialog
            visible={state.permsOpen}
            initial={state.perms}
            onApply={handleApplyPerms}
            onClose={() => setState(prev => ({ ...prev, permsOpen: false }))}
          />
        </>
      )}

      {children}
    </form>
  )
}

export default AccountForm
