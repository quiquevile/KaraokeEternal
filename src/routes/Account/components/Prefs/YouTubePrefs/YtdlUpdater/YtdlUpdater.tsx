import React, { useEffect, useState } from 'react'
import { useAppDispatch, useAppSelector } from 'store/hooks'
import Button from 'components/Button/Button'
import Modal from 'components/Modal/Modal'
import { fetchYtdlVersion, updateYtdl } from 'store/modules/youtube'
import { formatDate } from 'lib/dateTime'
import styles from './YtdlUpdater.css'

const YtdlUpdater = () => {
  const dispatch = useAppDispatch()
  const version = useAppSelector(state => state.youtube.ytdlpVersion)
  const isUpdating = useAppSelector(state => state.youtube.ytdlpUpdating)
  const output = useAppSelector(state => state.youtube.ytdlpOutput)
  const error = useAppSelector(state => state.youtube.ytdlpError)
  const mode = useAppSelector(state => state.youtube.ytdlpMode)
  const status = useAppSelector(state => state.youtube.ytdlpStatus)
  const updatedAt = useAppSelector(state => state.youtube.ytdlpUpdatedAt)
  const dir = useAppSelector(state => state.youtube.ytdlpDir)
  const folder = useAppSelector(state => state.prefs.youtubeYtdlDir)
  const [dismissedEmptyKey, setDismissedEmptyKey] = useState<string | null>(null)

  useEffect(() => {
    dispatch(fetchYtdlVersion())
  }, [dispatch, folder])

  const emptyKey = `${folder ?? ''}|${dir ?? ''}`
  const showEmptyDialog = mode === 'managed' && status === 'empty' && dismissedEmptyKey !== emptyKey

  const pad2 = (n: number) => String(n).padStart(2, '0')
  const formatUpdatedAt = (d: Date) => `${formatDate(d)} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`

  const handleUpdate = async () => {
    setDismissedEmptyKey(emptyKey)

    try {
      await dispatch(updateYtdl()).unwrap()
    } catch {
      // keep the last result so the user can retry
    }

    dispatch(fetchYtdlVersion())
  }

  const canUpdate = !isUpdating && mode === 'managed'

  const versionLabel = isUpdating
    ? 'Updating…'
    : (version ?? (status === 'empty' ? '—' : 'unknown'))

  return (
    <div className={styles.container}>
      <div className={styles.status}>
        <span className={styles.label}>yt-dlp version</span>
        <span className={styles.version}>{versionLabel}</span>
        {!!updatedAt && !isUpdating && (
          <span className={styles.updatedAt}>
            · updated
            {' '}
            {formatUpdatedAt(new Date(updatedAt))}
          </span>
        )}
      </div>

      <Button
        icon='REFRESH'
        onClick={handleUpdate}
        disabled={!canUpdate}
        className={styles.updateButton}
        title='Update yt-dlp'
      >
        {isUpdating ? 'Updating…' : (status === 'empty' ? 'Download' : 'Update')}
      </Button>

      {status === 'empty' && !(folder || dir) && (
        <div className={styles.emptyHint}>
          Select a yt-dlp folder to start using YouTube downloads.
        </div>
      )}

      {status === 'empty' && (folder || dir) && (
        <div className={styles.emptyHint}>
          The yt-dlp folder is empty. Download yt-dlp to start using it.
        </div>
      )}

      {status === 'system' && (
        <div className={styles.systemHint}>
          A custom yt-dlp binary is used and cannot be updated here.
        </div>
      )}

      {output && <pre className={error ? styles.outputError : styles.output}>{output}</pre>}

      {showEmptyDialog && (
        <Modal
          title='Download yt-dlp'
          className={styles.modal}
          onClose={() => {
            setDismissedEmptyKey(emptyKey)
          }}
          buttons={(
            <div className={styles.btnContainer}>
              <Button
                variant='default'
                onClick={() => {
                  setDismissedEmptyKey(emptyKey)
                }}
              >
                Cancel
              </Button>
              <Button
                variant='primary'
                onClick={() => {
                  setDismissedEmptyKey(emptyKey)
                  handleUpdate()
                }}
              >
                Download
              </Button>
            </div>
          )}
        >
          <div className={styles.emptyText}>
            The yt-dlp folder
            <strong>{folder || dir || '…'}</strong>
            is empty. Download the latest yt-dlp into it now?
          </div>
        </Modal>
      )}
    </div>
  )
}

export default YtdlUpdater
