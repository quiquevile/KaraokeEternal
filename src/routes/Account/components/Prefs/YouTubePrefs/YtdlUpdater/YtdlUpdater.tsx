import React, { useEffect, useState } from 'react'
import { FormattedMessage, useIntl } from 'react-intl'
import { useAppDispatch, useAppSelector } from 'store/hooks'
import Button from 'components/Button/Button'
import Modal from 'components/Modal/Modal'
import { fetchYtdlVersion, updateYtdl } from 'store/modules/youtube'
import { formatDate } from 'lib/dateTime'
import styles from './YtdlUpdater.css'
import { accountMessages } from '../../../../messages'
import { commonMessages } from '../../../../../../lib/messages'

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
    ? intl.formatMessage(accountMessages.updating)
    : (version ?? (status === 'empty'
        ? '—'
        : intl.formatMessage(accountMessages.unknown)))

  const updateLabel = intl.formatMessage(accountMessages.ytdlUpdate)

  return (
    <div className={styles.container}>
      <div className={styles.status}>
        <span className={styles.label}>
          <FormattedMessage {...accountMessages.version} />
        </span>
        <span className={styles.version}>{versionLabel}</span>
        {!!updatedAt && !isUpdating && (
          <span className={styles.updatedAt}>
            <FormattedMessage
              {...accountMessages.updatedAt}
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
          <FormattedMessage {...accountMessages.emptyNoFolder} />
        </div>
      )}

      {status === 'empty' && (folder || dir) && (
        <div className={styles.emptyHint}>
          <FormattedMessage {...accountMessages.emptyFolder} />
        </div>
      )}

      {status === 'system' && (
        <div className={styles.systemHint}>
          <FormattedMessage {...accountMessages.systemBinary} />
        </div>
      )}

      {output && <pre className={error ? styles.outputError : styles.output}>{output}</pre>}

      {showEmptyDialog && (
        <Modal
          title={intl.formatMessage(accountMessages.downloadTitle)}
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
                <FormattedMessage {...commonMessages.cancel} />
              </Button>
              <Button
                variant='primary'
                onClick={() => {
                  setDismissedEmptyKey(emptyKey)
                  handleUpdate()
                }}
              >
                <FormattedMessage {...commonMessages.download} />
              </Button>
            </div>
          )}
        >
          <div className={styles.emptyText}>
            <FormattedMessage
              {...accountMessages.emptyPrompt}
              values={{ strong: chunks => <strong>{chunks}</strong>, folder: folder || dir || '…' }}
            />
          </div>
        </Modal>
      )}
    </div>
  )
}

export default YtdlUpdater
