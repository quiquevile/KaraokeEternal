import React, { useState } from 'react'
import Button from 'components/Button/Button'
import Modal from 'components/Modal/Modal'
import { Permission } from 'shared/types'
import { PERMISSIONS } from './permissions'
import styles from './PermissionsDialog.css'

interface PermissionsDialogProps {
  visible: boolean
  initial: Record<string, boolean>
  onApply(perms: Record<string, boolean>): void
  onClose(): void
}

const PermissionsDialog = ({ visible, initial, onApply, onClose }: PermissionsDialogProps) => {
  const [draft, setDraft] = useState<Record<string, boolean>>(initial)

  const toggle = (value: Permission) => {
    setDraft(prev => ({ ...prev, [value]: !prev[value] }))
  }

  return (
    <Modal
      visible={visible}
      onClose={onClose}
      title='Permissions'
      buttons={(
        <>
          <Button variant='default' onClick={onClose}>
            Cancel
          </Button>
          <Button variant='primary' onClick={() => onApply(draft)}>
            Apply
          </Button>
        </>
      )}
    >
      <div className={styles.list}>
        {PERMISSIONS.map(p => (
          <Button
            key={p.value}
            variant={draft[p.value] ? 'primary' : undefined}
            className={draft[p.value] ? styles.permOn : styles.permOff}
            onClick={() => toggle(p.value)}
            aria-pressed={!!draft[p.value]}
            aria-label={p.label}
          >
            {p.label}
          </Button>
        ))}
      </div>
    </Modal>
  )
}

export default PermissionsDialog
