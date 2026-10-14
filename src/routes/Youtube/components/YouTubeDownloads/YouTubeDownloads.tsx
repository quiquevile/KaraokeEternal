import React, { useEffect } from 'react'
import { useIntl } from 'react-intl'
import { useAppDispatch, useAppSelector } from 'store/hooks'
import Button from 'components/Button/Button'
import { fetchDownloads, removeDownload } from 'store/modules/youtube'
import type { DownloadJob } from 'store/modules/youtube'
import styles from './YouTubeDownloads.css'
import { youtubeMessages } from '../../messages'

const STATUS_MESSAGES = {
  queued: youtubeMessages.queued,
  downloading: youtubeMessages.downloading,
  merging: youtubeMessages.merging,
  registering: youtubeMessages.registering,
  complete: youtubeMessages.complete,
  failed: youtubeMessages.failed,
} as const

const DownloadJobItem = ({ job, onRemove }: { job: DownloadJob, onRemove (id: string): void }) => {
  const isDone = job.status === 'complete' || job.status === 'failed'
  const intl = useIntl()
  const statusMessage = STATUS_MESSAGES[job.status as keyof typeof STATUS_MESSAGES]
  const statusLabel = statusMessage ? intl.formatMessage(statusMessage) : job.status

  return (
    <li className={styles.job}>
      <div className={styles.jobTitle}>
        {job.artist}
        {/* eslint-disable formatjs/no-literal-string-in-jsx -- punctuation around data, not prose */}
        {' '}
        -
        {' '}
        {/* eslint-enable formatjs/no-literal-string-in-jsx */}
        {job.title}
      </div>
      <div className={styles.jobStatus}>
        {statusLabel}
        {job.progress > 0 && job.status !== 'complete'
          // eslint-disable-next-line formatjs/no-literal-string-in-jsx -- punctuation around a count, not prose
          && ` (${Math.round(job.progress)}%)`}
        {job.error
          && (
            <span className={styles.error}>
              {/* eslint-disable formatjs/no-literal-string-in-jsx -- punctuation around data, not prose */}
              {' '}
              -
              {' '}
              {/* eslint-enable formatjs/no-literal-string-in-jsx */}
              {job.error}
            </span>
          )}
      </div>
      {isDone
        && (
          <Button
            icon='CLEAR'
            className={styles.remove}
            onClick={() => onRemove(job.id)}
            aria-label={intl.formatMessage(youtubeMessages.remove)}
          />
        )}
    </li>
  )
}

const YouTubeDownloads = () => {
  const downloads = useAppSelector(state => state.youtube.downloads)
  const dispatch = useAppDispatch()

  useEffect(() => {
    const id = window.setInterval(() => {
      dispatch(fetchDownloads())
    }, 2000)

    return () => window.clearInterval(id)
  }, [dispatch])

  if (!downloads) return null

  const jobs = [
    ...(downloads.active ? [downloads.active] : []),
    ...downloads.queue,
    ...downloads.history,
  ]

  if (jobs.length === 0) return null

  const handleRemove = (id: string) => dispatch(removeDownload(id))

  return (
    <div className={styles.container}>
      <ul className={styles.list}>
        {jobs.map(job => (
          <DownloadJobItem key={job.id} job={job} onRemove={handleRemove} />
        ))}
      </ul>
    </div>
  )
}

export default YouTubeDownloads
