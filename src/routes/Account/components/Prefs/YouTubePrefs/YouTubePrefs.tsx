import React, { useState } from 'react'
import { useAppDispatch, useAppSelector } from 'store/hooks'
import Accordion from 'components/Accordion/Accordion'
import Icon from 'components/Icon/Icon'
import { setPref } from 'store/modules/prefs'
import YouTubeSearch from './YouTubeSearch/YouTubeSearch'
import YouTubeDownloads from './YouTubeDownloads/YouTubeDownloads'
import styles from './YouTubePrefs.css'

const BinField = ({ value }: { value: string }) => {
  const [bin, setBin] = useState(value)
  const dispatch = useAppDispatch()

  const handleSave = () => {
    dispatch(setPref({ key: 'youtubeDlBin', data: bin.trim() || '' }))
  }

  return (
    <input
      type='text'
      value={bin}
      placeholder='yt-dlp'
      onChange={e => setBin(e.currentTarget.value)}
      onBlur={handleSave}
    />
  )
}

const YouTubePrefs = () => {
  const youtubeDownloadPathId = useAppSelector(state => state.prefs.youtubeDownloadPathId)
  const youtubeDlBin = useAppSelector(state => state.prefs.youtubeDlBin)
  const paths = useAppSelector(state => state.prefs.paths)
  const dispatch = useAppDispatch()

  const selectedPathId = youtubeDownloadPathId != null && paths.result.includes(youtubeDownloadPathId)
    ? youtubeDownloadPathId
    : paths.result[0]

  const handlePathChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const pathId = Number(e.currentTarget.value)

    if (Number.isInteger(pathId)) {
      dispatch(setPref({ key: 'youtubeDownloadPathId', data: pathId }))
    }
  }

  return (
    <Accordion
      className={styles.container}
      headingComponent={(
        <div className={styles.heading}>
          <Icon icon='TELEVISION_PLAY' size={32} className={styles.icon} />
          <div className={styles.title}>YouTube</div>
        </div>
      )}
    >
      <div className={styles.content}>
        <div className={styles.config}>
          <label className={styles.field}>
            <span className={styles.fieldLabel}>yt-dlp path</span>
            <BinField key={youtubeDlBin ?? ''} value={youtubeDlBin ?? ''} />
          </label>

          <label className={styles.field}>
            <span className={styles.fieldLabel}>Download folder</span>
            <select
              value={selectedPathId != null ? String(selectedPathId) : ''}
              onChange={handlePathChange}
              disabled={!paths.result.length}
            >
              {!paths.result.length
                && <option value=''>No media folders</option>}
              {paths.result.map(pathId => (
                <option key={pathId} value={String(pathId)}>{paths.entities[pathId].path}</option>
              ))}
            </select>
          </label>
        </div>

        <YouTubeSearch />
        <YouTubeDownloads />
      </div>
    </Accordion>
  )
}

export default YouTubePrefs
