import React, { useEffect } from 'react'
import { useAppDispatch, useAppSelector } from 'store/hooks'
import { fetchDownloads } from 'store/modules/youtube'
import type { DownloadJob } from 'store/modules/youtube'
import styles from './YouTubeDownloads.css'

const DownloadJobItem = ({ job }: { job: DownloadJob }) => (
  <li className={styles.job}>
    <div className={styles.jobTitle}>
      {job.artist}
      {' '}
      -
      {' '}
      {job.title}
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

  return (
    <div className={styles.container}>
      <ul className={styles.list}>
        {jobs.map(job => (
          <DownloadJobItem key={job.id} job={job} />
        ))}
      </ul>
    </div>
  )
}

export default YouTubeDownloads
