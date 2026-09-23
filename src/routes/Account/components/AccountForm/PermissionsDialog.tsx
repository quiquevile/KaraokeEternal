import React from 'react'
import Button from 'components/Button/Button'
import Modal from 'components/Modal/Modal'
import { Permission } from 'shared/types'
import { PERMISSIONS } from './permissions'
import styles from './PermissionsDialog.css'

interface PermissionsDialogProps {
  visible: boolean
  perms: Record<string, boolean>
  onToggle(value: Permission): void
  onClose(): void
}

const PermissionsDialog = ({ visible, perms, onToggle, onClose }: PermissionsDialogProps) => (
  <Modal visible={visible} onClose={onClose} title='Permissions'>
    <div className={styles.list}>
      {PERMISSIONS.map(p => (
        <Button
          key={p.value}
          variant={perms[p.value] ? 'primary' : undefined}
          className={perms[p.value] ? styles.permOn : styles.permOff}
          onClick={() => onToggle(p.value)}
          aria-pressed={!!perms[p.value]}
          aria-label={p.label}
        >
          {p.label}
        </Button>
      ))}
    </div>
  </Modal>
)

export default PermissionsDialog
