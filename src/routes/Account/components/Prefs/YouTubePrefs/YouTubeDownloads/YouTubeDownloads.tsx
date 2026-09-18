import React, { useEffect } from 'react'
import { useAppDispatch, useAppSelector } from 'store/hooks'
import Button from 'components/Button/Button'
import { fetchDownloads, removeDownload } from 'store/modules/youtube'
import type { DownloadJob } from 'store/modules/youtube'
import styles from './YouTubeDownloads.css'

const DownloadJobItem = ({ job, onRemove }: { job: DownloadJob, onRemove (id: string): void }) => {
  const isDone = job.status === 'complete' || job.status === 'failed'

  return (
    <li className={styles.job}>
      <div className={styles.jobTitleRow}>
        <div className={styles.jobTitle}>
          {job.artist}
          {' '}
          -
          {' '}
          {job.title}
        </div>
        {isDone
          && (
            <Button
              icon='CLEAR'
              size={20}
              className={styles.remove}
              onClick={() => onRemove(job.id)}
              aria-label='Remove notification'
            />
          )}
      </div>
      <div className={styles.jobStatus}>
        {job.status}
        {job.progress > 0 && job.status !== 'complete'
          && ` (${Math.round(job.progress)}%)`}
        {job.error
          && (
            <span className={styles.error}>
              {' '}
              -
              {' '}
              {job.error}
            </span>
          )}
      </div>
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
