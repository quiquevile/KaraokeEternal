import React, { useEffect, useRef, useState } from 'react'
import InputImage from 'components/InputImage/InputImage'
import { UserWithRole } from 'shared/types'
import styles from './AccountForm.css'

const PERMISSIONS = [
  { value: 'queueDelete', label: 'Puede borrar canciones de la cola' },
  { value: 'queueMove', label: 'Puede mover canciones de la cola' },
  { value: 'queueReplay', label: 'Puede reiniciar canciones de la cola' },
  { value: 'playerAccess', label: 'Puede abrir el reproductor' },
  { value: 'playerControls', label: 'Puede controlar la reproducción' },
]

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
  const permissionsRef = useRef<HTMLDivElement>(null)
  const [prevDateUpdated, setPrevDateUpdated] = useState(user?.dateUpdated)
  const [state, setState] = useState({
    isDirty: false,
    isChangingPassword: !user || user.userId === null,
    userImage: undefined as Blob | undefined,
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

  const updateDirty = () => {
    if (!user || user.userId === null) return

    const permsChanged = permissionsRef.current && user.permissions
      ? PERMISSIONS.some((p) => {
          const checkbox = permissionsRef.current!.querySelector(`[value="${p.value}"]`) as HTMLInputElement | null
          return !!checkbox && checkbox.checked !== !!user.permissions![p.value]
        })
      : false

    setState(prev => ({
      ...prev,
      isDirty: !!username.current?.value || !!newPassword.current?.value
        || (name.current?.value !== user.name)
        || (role.current && role.current.value !== (user.isAdmin ? '1' : '0'))
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

    if (permissionsRef.current) {
      const perms = PERMISSIONS.reduce((acc, p) => {
        const checkbox = permissionsRef.current.querySelector(`[value="${p.value}"]`) as HTMLInputElement
        if (checkbox?.checked) acc[p.value] = true
        return acc
      }, {} as Record<string, boolean>)
      data.append('permissions', JSON.stringify(perms))
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
          onChange={updateDirty}
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
          onChange={updateDirty}
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
          onChange={updateDirty}
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
        <div ref={permissionsRef} className={styles.permissions}>
          {PERMISSIONS.map(p => (
            <label key={p.value}>
              <input
                type='checkbox'
                name={p.value}
                value={p.value}
                defaultChecked={user?.permissions?.[p.value] ?? false}
              />
              {p.label}
            </label>
          ))}
        </div>
      )}

      {children}
    </form>
  )
}

export default AccountForm
