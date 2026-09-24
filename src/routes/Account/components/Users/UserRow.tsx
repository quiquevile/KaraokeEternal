import React, { useState } from 'react'
import { useAppDispatch } from 'store/hooks'
import Accordion from 'components/Accordion/Accordion'
import Button from 'components/Button/Button'
import InputCheckbox from 'components/InputCheckbox/InputCheckbox'
import { formatDateTime } from 'lib/dateTime'
import { PERMISSIONS } from '../AccountForm/permissions'
import { updateUser, type UserWithRoomsAndRole } from '../../modules/users'
import styles from './UserRow.css'

const onlyTrues = (permissions?: Record<string, boolean>) => (
  Object.fromEntries(
    PERMISSIONS.filter(p => permissions?.[p.value]).map(p => [p.value, true]),
  )
)

const UserRow = ({ user }: { user: UserWithRoomsAndRole }) => {
  const [perms, setPerms] = useState<Record<string, boolean>>(() => onlyTrues(user.permissions))
  const dispatch = useAppDispatch()

  const dirty = PERMISSIONS.some(p => !!perms[p.value] !== !!user.permissions?.[p.value])

  const toggle = (value: string) => {
    setPerms((prev) => {
      const next = { ...prev, [value]: !prev[value] }

      if (!next[value]) delete next[value]

      return next
    })
  }

  const handleSave = () => {
    const data = new FormData()
    data.append('permissions', JSON.stringify(perms))
    dispatch(updateUser({ userId: user.userId, data }))
  }

  return (
    <Accordion
      headingComponent={(
        <div className={styles.heading}>
          <strong>{user.username}</strong>
          {' '}
          (
          {user.name}
          )
          <span className={styles.role}>{user.role}</span>
          <span className={styles.joined}>{formatDateTime(new Date(user.dateCreated * 1000))}</span>
        </div>
      )}
    >
      <div className={styles.permissions}>
        {PERMISSIONS.map(p => (
          <InputCheckbox
            key={p.value}
            label={p.label}
            checked={!!perms[p.value]}
            onChange={() => toggle(p.value)}
          />
        ))}
        <Button
          variant='primary'
          onClick={handleSave}
          disabled={!dirty}
        >
          Save
        </Button>
      </div>
    </Accordion>
  )
}

export default UserRow
