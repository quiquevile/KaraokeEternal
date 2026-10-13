import React, { useEffect, useState } from 'react'
import { FormattedMessage, useIntl } from 'react-intl'
import { useAppDispatch } from 'store/hooks'
import Button from 'components/Button/Button'
import Modal, { ModalProps } from 'components/Modal/Modal'
import HttpApi from 'lib/HttpApi'
import { moveMedia } from 'store/modules/songInfo'
import styles from './MoveVersionDialog.css'

const api = new HttpApi('media')

interface MoveTarget {
  pathId: number
  path: string
  folders: string[]
}

interface MoveVersionDialogProps {
  songId: number
  mediaId: number
  fileName: string
  onClose: ModalProps['onClose']
}

const MoveVersionDialog = ({ songId, mediaId, fileName, onClose }: MoveVersionDialogProps) => {
  const [targets, setTargets] = useState<MoveTarget[] | null>(null)
  const [selected, setSelected] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isMoving, setIsMoving] = useState(false)
  const dispatch = useAppDispatch()
  const intl = useIntl()

  useEffect(() => {
    api.get<{ paths: MoveTarget[] }>('/move-targets')
      .then(res => setTargets(res.paths))
      .catch((err: unknown) => setError(err instanceof Error ? err.message : String(err)))
  }, [])

  const handleMove = () => {
    if (!selected || isMoving) return

    setIsMoving(true)
    setError(null)
    dispatch(moveMedia({ songId, mediaId, destDir: selected }))
      .unwrap()
      .then(onClose)
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : String(err))
        setIsMoving(false)
      })
  }

  return (
    <Modal
      onClose={onClose}
      title={intl.formatMessage({ id: 'moveFile.title', defaultMessage: 'Move file' })}
      buttons={(
        <div className={styles.btnContainer}>
          <Button onClick={onClose} variant='default'>
            <FormattedMessage id='moveFile.cancel' defaultMessage='Cancel' />
          </Button>
          <Button onClick={handleMove} variant='primary' disabled={!selected || isMoving}>
            <FormattedMessage id='moveFile.move' defaultMessage='Move' />
          </Button>
        </div>
      )}
    >
      <div className={styles.container} translate='no'>
        <p className={styles.file}>
          {fileName}
        </p>

        {targets === null && !error && (
          <p>
            <FormattedMessage id='moveFile.loading' defaultMessage='Loading folders…' />
          </p>
        )}

        {targets !== null && targets.map(target => (
          <div key={target.pathId} className={styles.group}>
            <div className={styles.groupTitle}>{target.path}</div>
            {target.folders.map((folder) => {
              const destDir = folder === '' ? target.path : `${target.path}/${folder}`

              return (
                <label key={folder} className={styles.row}>
                  <input
                    type='radio'
                    name='move-target'
                    checked={selected === destDir}
                    onChange={() => setSelected(destDir)}
                  />
                  <span>
                    {folder === ''
                      ? intl.formatMessage({ id: 'moveFile.thisFolder', defaultMessage: '(this folder)' })
                      : folder}
                  </span>
                </label>
              )
            })}
          </div>
        ))}

        {error
          && <p className={styles.error}>{error}</p>}
      </div>
    </Modal>
  )
}

export default MoveVersionDialog
