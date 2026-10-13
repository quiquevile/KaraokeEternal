import React, { useEffect, useState } from 'react'
import { FormattedMessage, useIntl } from 'react-intl'
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
  const intl = useIntl()

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
    ? intl.formatMessage({ id: 'account.ytdl.updating', defaultMessage: 'Updating…' })
    : (version ?? (status === 'empty'
        ? '—'
        : intl.formatMessage({ id: 'account.ytdl.unknown', defaultMessage: 'unknown' })))

  const updateLabel = intl.formatMessage({ id: 'account.ytdl.update', defaultMessage: 'Update yt-dlp' })

  return (
    <div className={styles.container}>
      <div className={styles.status}>
        <span className={styles.label}>
          <FormattedMessage id='account.ytdl.version' defaultMessage='yt-dlp version' />
        </span>
        <span className={styles.version}>{versionLabel}</span>
        {!!updatedAt && !isUpdating && (
          <span className={styles.updatedAt}>
            <FormattedMessage
              id='account.ytdl.updatedAt'
              defaultMessage='· updated {date}'
              values={{ date: formatUpdatedAt(new Date(updatedAt)) }}
            />
          </span>
        )}
        <Button
          icon='REFRESH'
          onClick={handleUpdate}
          disabled={!canUpdate}
          className={styles.updateButton}
          title={updateLabel}
          aria-label={updateLabel}
        />
      </div>

      {status === 'empty' && !(folder || dir) && (
        <div className={styles.emptyHint}>
          <FormattedMessage
            id='account.ytdl.emptyNoFolder'
            defaultMessage='Select a yt-dlp folder to start using YouTube downloads.'
          />
        </div>
      )}

      {status === 'empty' && (folder || dir) && (
        <div className={styles.emptyHint}>
          <FormattedMessage
            id='account.ytdl.emptyFolder'
            defaultMessage='The yt-dlp folder is empty. Download yt-dlp to start using it.'
          />
        </div>
      )}

      {status === 'system' && (
        <div className={styles.systemHint}>
          <FormattedMessage
            id='account.ytdl.systemBinary'
            defaultMessage='A custom yt-dlp binary is used and cannot be updated here.'
          />
        </div>
      )}

      {output && <pre className={error ? styles.outputError : styles.output}>{output}</pre>}

      {showEmptyDialog && (
        <Modal
          title={intl.formatMessage({ id: 'account.ytdl.downloadTitle', defaultMessage: 'Download yt-dlp' })}
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
                <FormattedMessage id='account.ytdl.cancel' defaultMessage='Cancel' />
              </Button>
              <Button
                variant='primary'
                onClick={() => {
                  setDismissedEmptyKey(emptyKey)
                  handleUpdate()
                }}
              >
                <FormattedMessage id='account.ytdl.download' defaultMessage='Download' />
              </Button>
            </div>
          )}
        >
          <div className={styles.emptyText}>
            <FormattedMessage
              id='account.ytdl.emptyPrompt'
              defaultMessage='The yt-dlp folder <strong>{folder}</strong> is empty. Download the latest yt-dlp into it now?'
              values={{ strong: chunks => <strong>{chunks}</strong>, folder: folder || dir || '…' }}
            />
          </div>
        </Modal>
      )}
    </div>
  )
}

export default YtdlUpdater
