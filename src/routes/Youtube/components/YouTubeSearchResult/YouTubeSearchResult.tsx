import React from 'react'
import { useAppDispatch } from 'store/hooks'
import { openPreview, selectYoutubeResult } from 'store/modules/youtube'
import type { YouTubeResult } from 'store/modules/youtube'
import Icon from 'components/Icon/Icon'
import styles from './YouTubeSearchResult.css'

const YouTubeSearchResult = ({ item }: { item: YouTubeResult }) => {
  const dispatch = useAppDispatch()

  const handlePreview = (event: React.MouseEvent) => {
    event.stopPropagation()
    dispatch(openPreview(item))
  }

  const handleDownload = () => {
    dispatch(selectYoutubeResult(item))
  }

  return (
    <li className={styles.container} onClick={handleDownload}>
      <button
        type='button'
        className={styles.thumbnailButton}
        onClick={handlePreview}
        aria-label='Preview'
      >
        <img className={styles.thumbnail} src={item.thumbnail} alt='' />
        <Icon icon='PLAY' size={40} className={styles.thumbnailPlay} />
      </button>

      <div className={styles.info}>
        <div className={styles.title}>{item.title}</div>
        <div className={styles.artist}>{item.artist}</div>
        <div className={styles.user}>{item.durationLabel}</div>
      </div>
    </li>
  )
}

export default YouTubeSearchResult
