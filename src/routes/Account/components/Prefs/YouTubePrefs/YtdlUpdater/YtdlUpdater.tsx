import React, { useEffect } from 'react'
import { useAppDispatch, useAppSelector } from 'store/hooks'
import Button from 'components/Button/Button'
import { fetchYtdlVersion, updateYtdl } from 'store/modules/youtube'
import styles from './YtdlUpdater.css'

const YtdlUpdater = () => {
  const dispatch = useAppDispatch()
  const version = useAppSelector(state => state.youtube.ytdlpVersion)
  const isUpdating = useAppSelector(state => state.youtube.ytdlpUpdating)
  const output = useAppSelector(state => state.youtube.ytdlpOutput)
  const error = useAppSelector(state => state.youtube.ytdlpError)

  useEffect(() => {
    dispatch(fetchYtdlVersion())
  }, [dispatch])

  const handleUpdate = () => {
    dispatch(updateYtdl())
  }

  return (
    <div className={styles.container}>
      <div className={styles.status}>
        <span className={styles.label}>yt-dlp version</span>
        <span className={styles.version}>
          {isUpdating ? 'Updating…' : (version ?? 'unknown')}
        </span>
      </div>

      <Button
        icon='REFRESH'
        onClick={handleUpdate}
        disabled={isUpdating}
        className={styles.updateButton}
        title='Update yt-dlp'
      >
        {isUpdating ? 'Updating…' : 'Update'}
      </Button>

      {output && <pre className={error ? styles.outputError : styles.output}>{output}</pre>}
    </div>
  )
}

export default YtdlUpdater
