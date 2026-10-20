import React, { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import clsx from 'clsx'
import { useIntl } from 'react-intl'
import Button from 'components/Button/Button'
import styles from './Modal.css'
import { sharedMessages } from '../messages'

export type ModalProps = {
  buttons?: React.ReactNode
  className?: string
  children?: React.ReactNode
  onClose: () => void
  scrollable?: boolean
  title: string
  visible?: boolean
}

const Modal = ({ buttons, className, children, visible = true, onClose, scrollable, title }: ModalProps) => {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const isOutsideClick = useRef(false)
  const intl = useIntl()

  useEffect(() => {
    const dialog = dialogRef.current

    // showModal throws if already open (e.g. StrictMode double-effects)
    if (visible && dialog && !dialog.open) {
      dialog.showModal()
    }

    return () => {
      if (dialog?.open) dialog.close()
    }
  }, [visible])

  const handleMouseDown = (event: React.MouseEvent<HTMLDialogElement>) => {
    isOutsideClick.current = event.target === dialogRef.current
  }

  const handleMouseUp = (event: React.MouseEvent<HTMLDialogElement>) => {
    if (isOutsideClick.current && event.target === dialogRef.current) {
      onClose()
    }
    isOutsideClick.current = false
  }

  const handleCancel = (e: React.SyntheticEvent) => {
    e.preventDefault()
    onClose()
  }

  if (!visible) return null

  // portal to <body>: modals are often rendered inside collapsed accordion
  // panels (hidden ancestors), where showModal() produces a zero-size
  // invisible dialog whose backdrop still blocks every click on the page
  return createPortal(
    <dialog
      ref={dialogRef}
      className={clsx(styles.container, className)}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      onCancel={handleCancel}
    >
      <div className={styles.titleContainer}>
        <h1>{title}</h1>
        <Button
          icon='CLEAR'
          className={styles.btnClose}
          onClick={onClose}
          aria-label={intl.formatMessage(sharedMessages.close)}
        />
      </div>
      <div className={clsx(styles.content, scrollable && styles.scrollable)}>{children}</div>
      {buttons && <div className={styles.buttons}>{buttons}</div>}
    </dialog>,
    document.body,
  )
}

export default Modal
